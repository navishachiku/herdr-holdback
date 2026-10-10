// State directory and the daemon's connection endpoint. HERDR_HOLDBACK_STATE_DIR exists only for test isolation.
import os from 'node:os';
import path from 'node:path';

export const STATE_DIR = process.env.HERDR_HOLDBACK_STATE_DIR
  || process.env.HERDR_PLUGIN_STATE_DIR
  || path.join(os.homedir(), '.local', 'state', 'herdr', 'plugins', 'herdr-holdback');
export const QUEUE_FILE = path.join(STATE_DIR, 'queue.json');
export const SOCKET = process.platform === 'win32'
  ? `\\\\.\\pipe\\herdr-holdback-${os.userInfo().username}`
  : path.join(STATE_DIR, 'd.sock');
