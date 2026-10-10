// User settings: config.toml under the directory returned by `herdr plugin config-dir herdr-holdback`;
// default values are written on first run. The daemon may also be spawned from an agent's shell,
// which has no plugin environment variables, so the CLI is the only lookup path.
// Only the check interval is configurable; how long a message waits before auto-send (5 minutes) is not.
import fs from 'node:fs';
import path from 'node:path';
import * as herdr from './herdr.mjs';

export const DEFAULT_CONFIG = { checkIntervalSeconds: 30 };

const TEMPLATE = `# herdr-holdback
#
# How often (in seconds) the daemon checks whether the pane you are watching has
# messages that have waited 5 minutes. Takes effect when the daemon restarts.
check_interval_seconds = ${DEFAULT_CONFIG.checkIntervalSeconds}
`;

export function loadConfig(dir) {
  if (!dir) return DEFAULT_CONFIG;
  const file = path.join(dir, 'config.toml');
  try {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, TEMPLATE);
      return DEFAULT_CONFIG;
    }
    return parseConfig(fs.readFileSync(file, 'utf8'));
  } catch { return DEFAULT_CONFIG; }
}

// Only `key = number` lines are needed, so no full TOML parser is pulled in.
export function parseConfig(text) {
  const m = /^\s*check_interval_seconds\s*=\s*(\d+(?:\.\d+)?)\s*(#.*)?$/m.exec(text);
  const n = m ? Number(m[1]) : 0;
  return { checkIntervalSeconds: n > 0 ? n : DEFAULT_CONFIG.checkIntervalSeconds };
}

export async function loadConfigFromHerdr() {
  try { return loadConfig((await herdr.run(['plugin', 'config-dir', 'herdr-holdback'])).trim()); } catch { return DEFAULT_CONFIG; }
}
