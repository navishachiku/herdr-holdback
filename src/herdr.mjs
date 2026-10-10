// Thin wrapper around the herdr CLI. Uses only HERDR_BIN_PATH and never touches the socket, so it behaves the same on every platform.
import { execFile } from 'node:child_process';

export function run(args) {
  const bin = process.env.HERDR_BIN_PATH || 'herdr';
  return new Promise((resolve, reject) => {
    execFile(bin, args, { encoding: 'utf8', timeout: 15000 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr }));
      else resolve(stdout);
    });
  });
}

export async function listPanes() {
  return JSON.parse(await run(['pane', 'list'])).result.panes;
}

// Panes with an agent go through agent prompt (pastes the text and presses Enter); plain terminals use pane run.
export function deliver(pane, text) {
  return pane.agent
    ? run(['agent', 'prompt', pane.pane_id, text])
    : run(['pane', 'run', pane.pane_id, text]);
}

export function notify(title, body) {
  return run(['notification', 'show', title, '--body', body, '--sound', 'request']);
}

// 5 drawn rows (header, divider, one message row, hint row, one spare) plus the two border rows that the layout rect includes.
const BAR_ROWS = 7;

// Button bar above the pane: split a cell below the target, swap positions with the target, then size it to BAR_ROWS rows. Does not steal focus.
export async function openBar(target) {
  const res = JSON.parse(await run(['plugin', 'pane', 'open', '--plugin', 'herdr-holdback', '--entrypoint', 'bar',
    '--placement', 'split', '--target-pane', target, '--direction', 'down', '--env', `HOLDBACK_TARGET=${target}`, '--no-focus']));
  const bar = res.result.plugin_pane.pane.pane_id;
  await run(['pane', 'swap', '--source-pane', bar, '--target-pane', target]);
  // Focus stays with the position on swap (that is, on the bar); hand it back to the target pane.
  await run(['pane', 'focus', '--pane', bar, '--direction', 'down']);
  // Fixed height, independent of window size: header, divider, one message row and the hint row (see draw in src/bar.mjs).
  // Best effort: steps are ratios of the parent split, so the loop may stop near BAR_ROWS; a failed resize leaves the bar at its current height instead of throwing, so the caller still tracks it and does not open a second bar.
  for (let i = 0; i < 24; i++) {
    const layout = JSON.parse(await run(['pane', 'layout', '--pane', bar])).result.layout.panes;
    const height = layout.find(p => p.pane_id === bar).rect.height;
    if (height === BAR_ROWS) break;
    try {
      await run(['pane', 'resize', '--pane', bar, '--direction', height > BAR_ROWS ? 'up' : 'down', '--amount', height > BAR_ROWS ? '0.1' : '0.02']);
    } catch { break; }
  }
  return bar;
}

export function closeBar(bar) {
  return run(['plugin', 'pane', 'close', bar]);
}

// Read what the pane currently shows (with ANSI color codes), to tell whether anyone is typing in the input box.
export function readScreen(pane) {
  return run(['pane', 'read', pane, '--source', 'visible', '--lines', '40', '--format', 'ansi']);
}
