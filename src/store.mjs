// Queue persistence: every change rewrites the whole file atomically, so a restarted daemon reads back exactly what was there.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    this.queues = {};
    this.focused = null;
    this.seq = 0;
    this.bars = {}; // target pane → its bottom button-bar pane
  }

  load() {
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.queues = d.queues ?? {};
      this.focused = d.focused ?? null;
      this.seq = d.seq ?? 0;
      this.bars = d.bars ?? {};
    } catch { /* first start or corrupt file: begin with an empty queue */ }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ queues: this.queues, focused: this.focused, seq: this.seq, bars: this.bars }));
    fs.renameSync(tmp, this.file);
  }

  list(pane) { return this.queues[pane] ?? []; }

  push(pane, msg) {
    (this.queues[pane] ??= []).push({ id: ++this.seq, ts: Date.now(), ...msg });
    this.save();
  }

  shift(pane) {
    const q = this.queues[pane];
    const m = q?.shift();
    if (q && q.length === 0) delete this.queues[pane];
    this.save();
    return m;
  }

  drop(pane) {
    delete this.queues[pane];
    this.save();
  }
}
