// Queue daemon. Decides whether a message is queued or delivered directly, flushes when focus
// leaves a pane, and maintains the button bar on the pane. All requests are handled serially so
// two focus events never flush the same queue at once.
import fs from 'node:fs';
import net from 'node:net';
import { SOCKET, QUEUE_FILE, STATE_DIR } from './paths.mjs';
import { Store } from './store.mjs';
import { loadConfigFromHerdr } from './config.mjs';
import * as herdr from './herdr.mjs';
import { t } from './messages.mjs';
import { typedText } from './input-box.mjs';

const HEAD = 40;
// Auto-send after queueing this long; the two environment variables exist only to shorten the
// timing in tests; the check interval normally comes from the user's config.
const AUTO_SEND_MS = Number(process.env.HERDR_HOLDBACK_AUTO_SEND_MS) || 5 * 60 * 1000;
const TICK_MS = Number(process.env.HERDR_HOLDBACK_TICK_MS) || (await loadConfigFromHerdr()).checkIntervalSeconds * 1000;
const store = new Store(QUEUE_FILE);
store.load();

// The sender signature is the "<signature> 💬 " prefix of the message (enforced by the send
// guard); without one, the from argument is used.
function parse(text, from) {
  const m = /^(.+?) 💬 ([\s\S]*)$/.exec(text);
  return { from: from || m?.[1] || 'unknown', head: (m ? m[2] : text).replace(/\s+/g, ' ').slice(0, HEAD) };
}

async function show(pane, panes) {
  try { await syncBar(pane, panes ?? await herdr.listPanes()); } catch { /* a display failure must not affect the queue */ }
}

// Pin a button bar to the pane while it has pending messages and remove it once the queue is
// empty. If someone closes the bar by hand, it is reopened next time.
async function syncBar(pane, panes) {
  const n = store.list(pane).length;
  const bar = store.bars[pane];
  const alive = bar && panes.some(p => p.pane_id === bar);
  if (n > 0 && !alive) {
    store.bars[pane] = await herdr.openBar(pane);
    store.save();
  } else if (n === 0 && bar) {
    if (alive) await herdr.closeBar(bar);
    delete store.bars[pane];
    store.save();
  }
}

// Send one by one in arrival order; a message leaves the queue only after it was sent, and a
// failure stops the run and keeps the rest untouched.
async function flush(pane, panes) {
  const target = panes.find(p => p.pane_id === pane);
  let sent = 0;
  let error;
  if (!target) error = 'pane not found';
  else {
    while (store.list(pane).length) {
      try { await herdr.deliver(target, store.list(pane)[0].text); } catch (e) { error = String(e.stderr || e.message).trim(); break; }
      store.shift(pane);
      sent++;
    }
  }
  await show(pane, panes);
  return { sent, left: store.list(pane).length, ...(error && { error }) };
}

// Go by where focus is now: if the remembered previous focus is a different pane that has a
// queue, focus just left it, so flush it. Queues of panes that no longer exist are dropped.
async function reconcile(panes, focusedRaw) {
  const prev = store.focused;
  // Focus on a pane's button bar counts as still watching that pane (clicking the bar moves focus there first).
  const owner = Object.keys(store.bars).find(k => store.bars[k] === focusedRaw);
  const focusedNow = owner ?? focusedRaw;
  for (const pane of Object.keys(store.queues)) {
    if (!panes.some(p => p.pane_id === pane)) store.drop(pane);
  }
  if (focusedNow) {
    if (prev && prev !== focusedNow && store.list(prev).length && !(await typing(prev))) await flush(prev, panes);
    store.focused = focusedNow;
    store.save();
  }
}

// Do not send while the input box holds text the user typed (any send path: focus leaving, bar click, list Enter, auto-send). An unreadable
// screen counts as typed text: better late than interrupting.
async function typing(pane) {
  try { return typedText(await herdr.readScreen(pane)) !== ''; } catch { return true; }
}

// For the pane being watched, once the oldest queued message reaches the time limit the whole
// batch is sent, so messages do not stay stuck while the user is away.
async function autoSend() {
  const panes = await herdr.listPanes();
  await reconcile(panes, panes.find(p => p.focused)?.pane_id);
  const pane = store.focused;
  const oldest = pane && store.list(pane)[0];
  if (oldest && Date.now() - oldest.ts >= AUTO_SEND_MS && !(await typing(pane))) await flush(pane, panes);
  // Queues held back on panes nobody is watching: send as soon as their input box is clear.
  for (const other of Object.keys(store.queues)) {
    if (other !== pane && store.list(other).length && !(await typing(other))) await flush(other, panes);
  }
}

const handlers = {
  async enqueue({ to, text, from }) {
    const panes = await herdr.listPanes();
    await reconcile(panes, panes.find(p => p.focused)?.pane_id);
    const target = panes.find(p => p.pane_id === to);
    if (!target) return { ok: false, error: `pane ${to} not found` };
    const watched = store.focused === to;
    // An unwatched pane whose input box holds half-typed text queues too; autoSend sends once the text is gone.
    const hold = !watched && await typing(to);
    if (!watched && !hold && store.list(to).length === 0) {
      await herdr.deliver(target, text);
      return { ok: true, queued: false };
    }
    const info = parse(text, from);
    store.push(to, { from: info.from, text });
    if (hold) { await show(to, panes); return { ok: true, queued: true, count: store.list(to).length }; }
    if (!watched) return { ok: true, queued: false, ...(await flush(to, panes)) };
    await show(to, panes);
    try { await herdr.notify(t.notifyTitle(info.from), info.head); } catch { /* a notification failure must not affect queueing */ }
    return { ok: true, queued: true, count: store.list(to).length };
  },

  async focus({ pane }) {
    const panes = await herdr.listPanes();
    await reconcile(panes, pane);
    return { ok: true };
  },

  async list({ pane }) {
    return { ok: true, messages: store.list(pane).map(({ from, text }) => ({ from, text })) };
  },

  async flush({ pane }) {
    if (store.list(pane).length && await typing(pane)) return { ok: true, blocked: 'typing', sent: 0, left: store.list(pane).length };
    return { ok: true, ...(await flush(pane, await herdr.listPanes())) };
  },

  async status() {
    return { ok: true, pid: process.pid, focused: store.focused, counts: Object.fromEntries(Object.entries(store.queues).map(([k, v]) => [k, v.length])) };
  },
};

let chain = Promise.resolve();
function serial(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

function serve() {
  const server = net.createServer(conn => {
    let buf = '';
    conn.setEncoding('utf8');
    conn.on('error', () => {});
    conn.on('data', d => {
      buf += d;
      if (!buf.includes('\n')) return;
      let req;
      try { req = JSON.parse(buf); } catch { return conn.end(JSON.stringify({ ok: false, error: 'bad request' })); }
      serial(() => handlers[req.op]?.(req) ?? { ok: false, error: `unknown op ${req.op}` })
        .catch(e => ({ ok: false, error: String(e.stderr || e.message).trim() }))
        .then(res => conn.end(JSON.stringify(res)));
    });
  });
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (process.platform !== 'win32') { try { fs.unlinkSync(SOCKET); } catch { /* no stale file */ } }
  server.on('error', () => process.exit(1));
  server.listen(SOCKET, async () => {
    // Seed from pane list at startup: focus changes missed while restarting are reconciled here.
    try {
      const panes = await herdr.listPanes();
      await serial(() => reconcile(panes, panes.find(p => p.focused)?.pane_id));
    } catch { /* herdr temporarily unavailable: reconcile on the first event */ }
  });
  setInterval(() => { serial(autoSend).catch(() => { /* herdr temporarily unavailable: retry next round */ }); }, TICK_MS);
  const stop = () => { server.close(); if (process.platform !== 'win32') { try { fs.unlinkSync(SOCKET); } catch { /* already removed */ } } process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

// Exit if another daemon is already running, so two never fight over the same queue file.
const probe = net.connect(SOCKET);
probe.on('connect', () => { probe.destroy(); process.exit(0); });
probe.on('error', serve);
