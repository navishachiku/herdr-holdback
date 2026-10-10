// herdr-holdback plugin: one positive and one negative test per acceptance criterion.
// The daemon and the entry scripts are real; only herdr is replaced by a fake executable that
// logs its calls (HERDR_BIN_PATH), and the tests edit panes.json to simulate the pane list and focus.
// Mapping: AC1 queueing and notification, AC2 no count shown, AC3 pending list, AC4 Enter sends all,
// AC5 Esc, AC6 focus leaves, AC7 unwatched pane gets direct delivery, AC8 daemon restart,
// AC9 auto-send after the queue time limit (an environment variable shrinks 5 minutes to 1.5 seconds).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SRC = import.meta.dirname;
const FAKE = `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const dir = process.env.FAKE_DIR, args = process.argv.slice(2);
if (args[0] === 'pane' && args[1] === 'list') {
  console.log(JSON.stringify({ result: { panes: JSON.parse(fs.readFileSync(path.join(dir, 'panes.json'), 'utf8')) } }));
  process.exit(0);
}
if (args[0] === 'plugin' && args[1] === 'config-dir') {
  console.log(path.join(dir, 'cfg'));
  process.exit(0);
}
if (args[0] === 'pane' && args[1] === 'read') {
  if (fs.existsSync(path.join(dir, 'read-fail'))) process.exit(1);
  if (fs.existsSync(path.join(dir, 'screen.ansi'))) process.stdout.write(fs.readFileSync(path.join(dir, 'screen.ansi'), 'utf8'));
  process.exit(0);
}
const deliver = args[0] === 'agent' && args[1] === 'prompt' || args[0] === 'pane' && args[1] === 'run';
if (deliver && fs.existsSync(path.join(dir, 'fail-on'))) {
  const n = fs.readFileSync(path.join(dir, 'fail-on'), 'utf8').trim();
  const done = fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').split('\\n').filter(l => l.includes('"agent","prompt"')).length : 0;
  if (String(done + 1) === n) { process.stderr.write('boom'); process.exit(1); }
}
fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify(args) + '\\n');
`;

// Run list.mjs in a pty (it needs raw mode), send a key sequence, then return the screen and whether it has exited.
const PTY = `
import os, pty, sys, time, select, signal
keys = sys.argv[1].encode().decode('unicode_escape').encode('latin1')
pid, fd = pty.fork()
if pid == 0:
    os.execvp('node', ['node', sys.argv[2]])
out = b''
def drain(t):
    global out
    end = time.time() + t
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.1)
        if r:
            try: out += os.read(fd, 4096)
            except OSError: return
drain(1.2)
if keys: os.write(fd, keys)
drain(1.0)
done, _ = os.waitpid(pid, os.WNOHANG)
if not done: os.kill(pid, signal.SIGKILL)
sys.stdout.write(out.decode('utf8', 'replace') + ('\\n[exited]' if done else '\\n[running]'))
`;

function rig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
  const bin = path.join(dir, 'herdr');
  fs.writeFileSync(bin, FAKE, { mode: 0o755 });
  const env = { ...process.env, HERDR_BIN_PATH: bin, FAKE_DIR: dir, HERDR_HOLDBACK_STATE_DIR: path.join(dir, 's') };
  const r = {
    dir, env,
    panes(focused) {
      fs.writeFileSync(path.join(dir, 'panes.json'), JSON.stringify(['w1:p1', 'w1:p2', 'w1:p3'].map(id => ({ pane_id: id, agent: 'claude', focused: id === focused }))));
    },
    run(script, args = [], extra = {}) {
      const res = spawnSync(process.execPath, [path.join(SRC, script), ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
      return res.stdout.trim() ? JSON.parse(res.stdout.trim().split('\n').pop()) : res;
    },
    send: (to, text) => r.run('send.mjs', ['--to', to, text]),
    focus: pane => r.run('on-focus.mjs', [], { HERDR_PLUGIN_EVENT_JSON: JSON.stringify({ data: { pane_id: pane } }) }),
    calls: () => (fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []),
    prompts: () => r.calls().filter(c => c[0] === 'agent' && c[1] === 'prompt').map(c => [c[2], c[3]]),
    queue: () => JSON.parse(fs.readFileSync(path.join(dir, 's', 'queue.json'), 'utf8')).queues,
    popup(keys, pane) {
      const res = spawnSync('python3', ['-I', '-c', PTY, keys, path.join(SRC, 'list.mjs')], { env: { ...env, HOLDBACK_TARGET: pane }, encoding: 'utf8' });
      return res.stdout;
    },
    stop() {
      try {
        const out = spawnSync(process.execPath, ['--input-type=module', '-e', `import { call } from '${path.join(SRC, 'ipc.mjs')}'; console.log(JSON.stringify(await call({ op: 'status' })))`], { env, encoding: 'utf8' });
        process.kill(JSON.parse(out.stdout).pid, 'SIGTERM');
      } catch { /* never started */ }
    },
  };
  test.after(() => { r.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  return r;
}
const W = 'w1:p1', OTHER = 'w1:p2';
const A = 'Task-58/TL 💬 At gate 1: all 10 criteria checked';
const B = 'Task-59/TL 💬 blocked: deployment list grouping needs PM to confirm the name';

test('AC1: positive, message to the watched pane → not typed into the input box; a notification shows sender and start', () => {
  const r = rig(); r.panes(W);
  assert.equal(r.send(W, A).queued, true);
  assert.deepEqual(r.prompts(), []);
  const n = r.calls().find(c => c[0] === 'notification');
  assert.match(n[2], /Task-58\/TL/);
  assert.equal(n[4], 'At gate 1: all 10 criteria checked');
});

test('AC1: negative, message to an unwatched pane → no notification', () => {
  const r = rig(); r.panes(W);
  r.send(OTHER, A);
  assert.equal(r.calls().filter(c => c[0] === 'notification').length, 0);
});

test('AC2: positive, while queued → no sidebar token, pane title or tab rename', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  assert.equal(r.queue()[W].length, 2);
  assert.deepEqual(r.calls().filter(c => c[1] === 'report-metadata' || (c[0] === 'tab' && c[1] === 'rename')), []);
});

test('AC2: negative, queued then sent → still no token, title or tab-rename calls throughout', () => {
  const r = rig(); r.panes(W);
  r.send(W, A);
  r.focus(OTHER);
  assert.equal(r.prompts().length, 1);
  assert.deepEqual(r.calls().filter(c => c[1] === 'report-metadata' || (c[0] === 'tab' && c[1] === 'rename')), []);
});

test('AC3: positive, pending list shows messages in arrival order', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  const screen = r.popup('', W);
  assert.match(screen, /Pending messages\s+2/);
  assert.ok(screen.indexOf('At gate 1') < screen.indexOf('blocked'));
});

test('AC3: negative, no queued messages → the list says so and shows no messages', () => {
  const r = rig(); r.panes(W);
  const screen = r.popup('', W);
  assert.match(screen, /No pending messages/);
  assert.doesNotMatch(screen, /1\./);
});

test('AC4: positive, Enter in the list → all sent in arrival order, queue cleared, count no longer shown', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  const screen = r.popup('\\r', W);
  assert.match(screen, /\[exited\]/);
  assert.deepEqual(r.prompts().map(p => p[1]), [A, B]);
  assert.deepEqual(r.queue(), {});
});

test('AC4: negative, failure halfway → sent ones leave the queue, unsent ones stay and are not lost', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  fs.writeFileSync(path.join(r.dir, 'fail-on'), '2');
  r.popup('\\r', W);
  assert.deepEqual(r.prompts().map(p => p[1]), [A]);
  assert.deepEqual(r.queue()[W].map(m => m.text), [B]);
});

test('AC5: positive, Esc in the list → closes, queue unchanged, nothing sent', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  const screen = r.popup('\\x1b', W);
  assert.match(screen, /\[exited\]/);
  assert.deepEqual(r.queue()[W].map(m => m.text), [A, B]);
  assert.deepEqual(r.prompts(), []);
});

test('AC5: negative, any key other than Esc → list stays open, nothing sent', () => {
  const r = rig(); r.panes(W);
  r.send(W, A);
  const screen = r.popup('x', W);
  assert.match(screen, /\[running\]/);
  assert.deepEqual(r.prompts(), []);
});

test('AC6: positive, focus leaves a pane with a queue → all sent in order, queue cleared', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  r.panes(OTHER);
  r.focus(OTHER);
  assert.deepEqual(r.prompts(), [[W, A], [W, B]]);
  assert.deepEqual(r.queue(), {});
});

test('AC6: negative, focus event on the same pane → nothing sent', () => {
  const r = rig(); r.panes(W);
  r.send(W, A);
  r.focus(W);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[W].length, 1);
});

test('AC7: positive, message to an unwatched pane → delivered once directly, not queued', () => {
  const r = rig(); r.panes(W);
  const res = r.send(OTHER, A);
  assert.equal(res.queued, false);
  assert.deepEqual(r.prompts(), [[OTHER, A]]);
});

test('AC7: negative, direct delivery to an unwatched pane leaves the queues of other panes untouched', () => {
  const r = rig(); r.panes(W);
  r.send(W, A);
  r.send(OTHER, B);
  assert.deepEqual(r.queue()[W].map(m => m.text), [A]);
  assert.deepEqual(r.prompts(), [[OTHER, B]]);
});

test('AC8: positive, daemon killed and restarted → unsent messages are still there and deliverable', () => {
  const r = rig(); r.panes(W);
  r.send(W, A); r.send(W, B);
  r.stop();
  spawnSync('sleep', ['0.5']);
  r.panes(OTHER);
  r.focus(OTHER);
  assert.deepEqual(r.prompts(), [[W, A], [W, B]]);
});

test('AC8: negative, restart does not resend messages already sent', () => {
  const r = rig(); r.panes(W);
  r.send(W, A);
  r.panes(OTHER); r.focus(OTHER);
  r.stop();
  spawnSync('sleep', ['0.5']);
  r.panes(W); r.focus(W);
  r.panes(OTHER); r.focus(OTHER);
  assert.deepEqual(r.prompts(), [[W, A]]);
});

const FAST = { HERDR_HOLDBACK_AUTO_SEND_MS: '1500', HERDR_HOLDBACK_TICK_MS: '200' };

test('AC9: positive, watched pane reaches the queue time limit → all auto-sent in order, queue cleared', () => {
  const r = rig(); r.panes(W);
  r.run('send.mjs', ['--to', W, A], FAST); r.send(W, B);
  spawnSync('sleep', ['2.5']);
  assert.deepEqual(r.prompts(), [[W, A], [W, B]]);
  assert.deepEqual(r.queue(), {});
});

test('AC9: negative, queue under the time limit and focus still on the pane → nothing sent', () => {
  const r = rig(); r.panes(W);
  r.run('send.mjs', ['--to', W, A], FAST);
  spawnSync('sleep', ['0.8']);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[W].length, 1);
});

test('AC9: regression, without plugin environment variables, the check interval still comes from the config directory herdr provides', () => {
  const r = rig(); r.panes(W);
  fs.mkdirSync(path.join(r.dir, 'cfg'));
  fs.writeFileSync(path.join(r.dir, 'cfg', 'config.toml'), 'check_interval_seconds = 0.2\n');
  r.run('send.mjs', ['--to', W, A], { HERDR_HOLDBACK_AUTO_SEND_MS: '1500', HERDR_PLUGIN_CONFIG_DIR: '' });
  spawnSync('sleep', ['2.5']);
  assert.deepEqual(r.prompts(), [[W, A]]);
});

// Input-box screens come from real captures (someone typing; an empty box with a dim placeholder), minus rows irrelevant to the check.
const RULE = '\x1b[0m\x1b[38;2;136;136;136m' + '─'.repeat(40) + '\x1b[0m\r\n';
const SCREEN_TYPED = RULE + '❯\u00a0typed by po\r\n' + RULE;
const SCREEN_EMPTY = RULE + '❯ \x1b[0m\x1b[2mTry "create a util logging.py that..."\x1b[0m\r\n' + RULE;

test('AC10: positive, time limit reached but the input box has user-typed text → not sent; sent next round once the text is gone', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_TYPED);
  r.run('send.mjs', ['--to', W, A], FAST);
  spawnSync('sleep', ['2.5']);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[W].length, 1);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_EMPTY);
  spawnSync('sleep', ['1']);
  assert.deepEqual(r.prompts(), [[W, A]]);
});

test('AC10: negative, time limit reached and the input box holds only a suggestion → sent in order', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_EMPTY);
  r.run('send.mjs', ['--to', W, A], FAST); r.send(W, B);
  spawnSync('sleep', ['2.5']);
  assert.deepEqual(r.prompts(), [[W, A], [W, B]]);
});

test('AC10: regression, input box unreadable → not sent this round; sent next round once it is readable', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'read-fail'), '');
  r.run('send.mjs', ['--to', W, A], FAST);
  spawnSync('sleep', ['2.5']);
  assert.deepEqual(r.prompts(), []);
  fs.rmSync(path.join(r.dir, 'read-fail'));
  spawnSync('sleep', ['1']);
  assert.deepEqual(r.prompts(), [[W, A]]);
});

test('AC11: focus leaves a pane whose input box has user-typed text → not sent, message stays queued', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_TYPED);
  r.send(W, A);
  r.panes(OTHER);
  r.focus(OTHER);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[W].length, 1);
});

test('AC12: Enter in the list (same check as a bar click) while the input box has user-typed text → not sent, hint shown, list stays open', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_TYPED);
  r.send(W, A);
  const screen = r.popup('\\r', W);
  assert.match(screen, /send or clear it first/);
  assert.match(screen, /\[running\]/);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[W].length, 1);
});

test('AC13: message to an unwatched pane whose input box has user-typed text → queued, not sent; sent once the text is gone', () => {
  const r = rig(); r.panes(W);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_TYPED);
  const res = r.run('send.mjs', ['--to', OTHER, A], FAST);
  assert.equal(res.queued, true);
  assert.deepEqual(r.prompts(), []);
  assert.equal(r.queue()[OTHER].length, 1);
  fs.writeFileSync(path.join(r.dir, 'screen.ansi'), SCREEN_EMPTY);
  spawnSync('sleep', ['1.5']);
  assert.deepEqual(r.prompts(), [[OTHER, A]]);
});

test('AC89: bar opened in a tall, a short and a tiny window → ends at the same height that fits sender, message head and hint row', async () => {
  const FAKE_LAYOUT = `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const dir = process.env.FAKE_DIR, a = process.argv.slice(2), f = path.join(dir, 'height');
const h = () => Number(fs.readFileSync(f, 'utf8'));
if (a[2] === 'open') console.log(JSON.stringify({ result: { plugin_pane: { pane: { pane_id: 'bar' } } } }));
else if (a[1] === 'layout') console.log(JSON.stringify({ result: { layout: { panes: [{ pane_id: 'bar', rect: { height: h() } }] } } }));
else if (a[1] === 'resize') fs.writeFileSync(f, String(a[a.indexOf('--direction') + 1] === 'up' ? Math.max(1, h() - Math.max(1, Math.round(h() * Number(a[a.indexOf('--amount') + 1])))) : h() + 1));
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'herdr');
  fs.writeFileSync(bin, FAKE_LAYOUT, { mode: 0o755 });
  const script = `import { openBar } from '${path.join(SRC, 'herdr.mjs')}'; await openBar('w1:p1');`;
  const ends = [];
  for (const start of [40, 12, 3]) {
    fs.writeFileSync(path.join(dir, 'height'), String(start));
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, HERDR_BIN_PATH: bin, FAKE_DIR: dir }, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    ends.push(Number(fs.readFileSync(path.join(dir, 'height'), 'utf8')));
  }
  assert.deepEqual(ends, [7, 7, 7]);
});
