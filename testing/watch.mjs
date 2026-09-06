#!/usr/bin/env node
// Serialized, debounced reruns. Evidence never triggers itself; no overlapping runs.
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
if (!args.includes('--build')) throw new Error('An explicit --build is required');
let child, pending = false, timer, stopped = false;
function run() {
  if (stopped) return;
  if (child) { pending = true; return; }
  console.log('Running local test/review loop…');
  child = spawn(process.execPath, ['testing/run.mjs', ...args], { stdio: 'inherit' });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => {
    child = null;
    console.log(`Run finished (${code}); evidence saved. Watching for changes.`);
    if (pending) { pending = false; run(); }
  });
}
const watcher = watch('.', { recursive: true }, (_event, file) => {
  if (!file || !/^(form-coach-[^/]+\.html|verify(?:-[^/]+)?\.mjs|package(?:-lock)?\.json|conformance-vectors\.json|voice\/.+\.(mp3|json)|testing\/(?!private\/|assets\/).+\.(mjs|js|json))$/.test(file)) return;
  clearTimeout(timer); timer = setTimeout(run, 500);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopped = true; clearTimeout(timer); watcher.close(); child?.kill(signal);
});
run();
