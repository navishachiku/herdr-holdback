// Bottom button bar: the first row shows the count and the button, the next rows show the
// sender and start of the latest messages, and the whole bar glows briefly when a new message
// arrives. A click (or Enter) sends every pending message into the target pane.
import { call } from './ipc.mjs';
import { run } from './herdr.mjs';
import { t } from './messages.mjs';

const pane = process.env.HOLDBACK_TARGET;
const self = process.env.HERDR_PANE_ID;
const out = process.stdout;

let count = -1;
let latest = '';
let items = []; // Latest few { from, head }, oldest first
let glow = 0; // 1 → 0: one soft fade-out when a new message arrives, then still
let timer;
let noticeTimer;
let notice = false; // Show the typing hint in place of the button for a few seconds after a blocked send

// Palette follows herdr's default cool gray-blue: one primary color (blue) for information,
// one action color (green) for the button, one alert color (red) only for the unread dot;
// secondary text always drops one gray level.
const C = {
  base: [46, 52, 64], warm: [76, 62, 66], line: [67, 76, 94],
  text: [236, 239, 244], dim: [129, 142, 168], blue: [136, 192, 208],
  green: [163, 190, 140], red: [235, 111, 124], ink: [36, 41, 51],
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, bgc) => `\x1b[${bgc ? 48 : 38};2;${c.join(';')}m`;

const head = text => text.replace(/^.*? 💬 /s, '').replace(/\s+/g, ' ');
const wide = c => c.charCodeAt(0) > 0x2e80;
const width = s => [...s].reduce((w, c) => w + (wide(c) ? 2 : 1), 0);
const fit = (s, n) => {
  if (width(s) <= n) return s;
  let out = '';
  for (const c of s) { if (width(out + c) > n - 1) break; out += c; }
  return `${out}…`;
};

// seg = [text, foreground, background?, bold?]; left segments align left, right segments align
// right, and the gap in between is filled with the panel color.
function row(panel, cols, left, right = []) {
  const paint = ([t, f, b, bold]) => `${bold ? '\x1b[1m' : '\x1b[22m'}${rgb(f)}${rgb(b ?? panel, true)}${t}`;
  const w = segs => segs.reduce((n, [t]) => n + width(t), 0);
  const gap = Math.max(1, cols - w(left) - w(right) - 1);
  return `${left.map(paint).join('')}${rgb(C.text)}${rgb(panel, true)}${' '.repeat(gap)}${right.map(paint).join('')}${rgb(C.text)}${rgb(panel, true)} \x1b[0m`;
}

// Layout: a header row on top (label, count, action button on the right), a divider, the latest
// few messages below (sender in the primary color, body in normal text, older ones grayed),
// and a hint row last. Content is vertically centered; the remaining rows are filled with the
// panel color.
function draw() {
  const rows = out.rows || 3;
  const cols = out.columns || 80;
  const panel = mix(C.base, C.warm, glow);
  const stripe = `${rgb(C.red, true)}  `;
  const room = cols - 3;
  const shown = Math.max(0, Math.min(items.length, rows - 4));
  const body = shown ? items.slice(-shown) : [];
  const lines = [
    row(panel, room, [[' ', C.text], [t.barLabel, C.ink, C.blue, true], [t.barCount(count), C.text, panel, true]], [[notice ? t.typingHint : t.barButton, C.ink, notice ? C.blue : C.green, true]]),
    row(panel, room, [['─'.repeat(Math.max(0, room - 2)), C.line]]),
    ...body.map((m, i) => {
      const fresh = i === body.length - 1;
      const from = fit(m.from, 18);
      return row(panel, room, [[' ', C.text], ['● ', fresh ? C.red : C.dim], [from, fresh ? C.blue : C.dim, panel, fresh], ['  ', C.text], [fit(m.head, Math.max(4, room - width(from) - 8)), fresh ? C.text : C.dim]]);
    }),
    ...(rows - 2 - body.length >= 2 ? [row(panel, room, [[t.barHint, C.dim]], [[t.barKeys, C.dim]])] : []),
  ];
  const top = Math.max(0, Math.floor((rows - lines.length) / 2));
  let frame = '';
  for (let r = 0; r < rows; r++) {
    frame += `\x1b[${r + 1};1H${stripe}${lines[r - top] ?? row(panel, room, [])}`;
  }
  out.write(frame);
}

// New message: the background fades from the warm color back to dark within 1.2 seconds, once.
function startGlow() {
  glow = 1;
  clearInterval(timer);
  timer = setInterval(() => {
    glow = Math.max(0, glow - 1 / 12);
    draw();
    if (glow <= 0) clearInterval(timer);
  }, 100);
}

async function refresh() {
  const { messages = [] } = await call({ op: 'list', pane }).catch(() => ({}));
  const next = messages.slice(-4).map(m => ({ from: m.from, head: head(m.text) }));
  const key = JSON.stringify(next);
  if (messages.length !== count || key !== latest) {
    const grew = messages.length > count && count >= 0;
    count = messages.length;
    latest = key;
    items = next;
    if (grew || (count > 0 && glow === 0 && next.length)) startGlow();
    draw();
  }
}

// Return focus to the target pane below before sending; if focus stays on the bar, whatever the
// user types next would go into the bar.
async function take() {
  if (self) await run(['pane', 'focus', '--pane', self, '--direction', 'down']).catch(() => {});
  const res = await call({ op: 'flush', pane }).catch(() => ({}));
  if (res.blocked) { notice = true; draw(); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice = false; draw(); }, 5000); }
  await refresh();
}

out.on('resize', () => count >= 0 && draw());
out.write('\x1b[?25l\x1b[?1000h\x1b[?1006h');
process.on('exit', () => out.write('\x1b[?1000l\x1b[?1006l\x1b[?25h'));
await refresh();
setInterval(refresh, 1000);

process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.on('data', async d => {
  const s = d.toString();
  const click = /\x1b\[<(\d+);\d+;\d+M/.exec(s);
  if ((click && click[1] === '0') || s === '\r') await take();
  if (s === '\x03') process.exit(0);
});
