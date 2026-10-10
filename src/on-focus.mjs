// pane.focused event: tell the daemon about the new focus so it can work out which pane was just left.
import { call } from './ipc.mjs';

const data = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON || '{}').data ?? {};
if (data.pane_id) await call({ op: 'focus', pane: data.pane_id }).catch(() => {});
