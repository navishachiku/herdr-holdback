import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('all production child-process calls hide Windows console windows', t => {
  const calls = [];
  // Test harnesses are outside the plugin runtime and are deliberately excluded.
  for (const file of fs.readdirSync(import.meta.dirname, { recursive: true })) {
    if (!file.endsWith('.mjs') || file.endsWith('.test.mjs')) continue;
    const source = fs.readFileSync(path.join(import.meta.dirname, file), 'utf8');
    for (const imported of source.matchAll(/import\s+(.+?)\s+from\s+['"](?:node:)?child_process['"]/g)) {
      assert.match(imported[1], /^\{.*\}$/, `${file}: use named child_process imports so the scan can resolve calls`);
      for (const binding of imported[1].slice(1, -1).split(',')) {
        const [name, alias = name] = binding.trim().split(/\s+as\s+/);
        if (!['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].includes(name)) continue;
        // Each invocation is inspected separately, through its terminating semicolon.
        const pattern = new RegExp(`\\b${alias}\\s*\\([^;]*;`, 'g');
        const matches = [...source.matchAll(pattern)];
        assert.ok(matches.length, `${file}: no calls found for ${alias}`);
        for (const match of matches) {
          calls.push(`${file}: ${alias}`);
          assert.match(match[0], /\bwindowsHide\s*:\s*true\b/, `${file}: ${alias} must set windowsHide: true`);
        }
      }
    }
  }
  assert.ok(calls.length, 'scan must find production child-process calls');
  t.diagnostic(`Checked ${calls.length} calls (excluding *.test.mjs): ${calls.join(', ')}`);
});
