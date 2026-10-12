// Connection between the plugin entry points and the daemon: one JSON line for the request, one for the response.
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOCKET } from './paths.mjs';

function request(msg) {
  return new Promise((resolve, reject) => {
    const c = net.connect(SOCKET);
    let buf = '';
    c.setEncoding('utf8');
    c.on('connect', () => c.write(`${JSON.stringify(msg)}\n`));
    c.on('data', d => { buf += d; });
    c.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    c.on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// If the connection fails, start a detached daemon and retry. The startup hook runs only once
// when herdr starts and does not fire when the plugin is linked or enabled or when the daemon is
// killed, so every entry point has to make sure the daemon is up itself.
export async function call(msg) {
  try { return await request(msg); } catch (e) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(e.code)) throw e;
  }
  spawn(process.execPath, [fileURLToPath(new URL('./daemon.mjs', import.meta.url))], {
    detached: true, stdio: 'ignore', env: process.env, windowsHide: true,
  }).unref();
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    try { return await request(msg); } catch (e) {
      if (!['ENOENT', 'ECONNREFUSED'].includes(e.code)) throw e;
    }
  }
  throw new Error('holdback daemon did not come up');
}
