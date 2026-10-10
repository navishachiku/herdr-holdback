// Pending-list popup: Enter sends everything, Esc closes.
import { call } from './ipc.mjs';
import { t } from './messages.mjs';

const pane = process.env.HOLDBACK_TARGET
  || JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || '{}').focused_pane_id;
const { messages = [] } = await call({ op: 'list', pane });

const out = process.stdout;
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const lines = [t.listTitle(messages.length), ''];
if (messages.length === 0) lines.push(t.listEmpty);
messages.slice(0, 10).forEach((m, i) => lines.push(`${i + 1}. ${cut(m.from, 20)}  ${cut(m.text.replace(/^.*? 💬 /s, '').replace(/\s+/g, ' '), 44)}`));
if (messages.length > 10) lines.push(t.listMore(messages.length - 10));
lines.push('', messages.length ? t.listSendHint(pane) : t.listCloseHint);
out.write(`\x1b[2J\x1b[H${lines.join('\r\n')}\r\n`);

if (!process.stdin.isTTY) process.exit(0);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', async key => {
  const k = key.toString();
  if (k === '\r' || k === '\n') {
    const res = messages.length ? await call({ op: 'flush', pane }).catch(() => ({})) : {};
    if (res.blocked) { out.write(`\r\n${t.typingHint.trim()}\r\n`); return; }
    process.exit(0);
  }
  if (k === '\x1b' || k === '\x03') process.exit(0);
});
