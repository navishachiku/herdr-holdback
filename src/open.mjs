// Shortcut action: open the pending-list popup for the focused pane.
import { run } from './herdr.mjs';

const pane = process.env.HERDR_PANE_ID;
if (!pane) process.exit(1);
await run(['plugin', 'pane', 'open', '--plugin', process.env.HERDR_PLUGIN_ID || 'herdr-holdback',
  '--entrypoint', 'list', '--placement', 'popup', '--env', `HOLDBACK_TARGET=${pane}`]);
