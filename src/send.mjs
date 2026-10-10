// Send entry point: node send.mjs --to <pane_id> [--from <signature>] <text...>
// Messages for the pane the user is watching are queued; all others are delivered directly.
// The send guard and the tests both go through this script.
import { call } from './ipc.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const to = opt('--to');
const from = opt('--from');
const text = args.join(' ');
if (!to || !text) { console.error('usage: send.mjs --to <pane_id> [--from <name>] <text>'); process.exit(2); }

const res = await call({ op: 'enqueue', to, from, text });
console.log(JSON.stringify(res));
process.exit(res.ok ? 0 : 1);
