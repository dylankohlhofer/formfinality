// Focused shell runs use the same assertions and evidence as the default suite.
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { loadEngine } from './lib.mjs';
import { shellSweep } from './shell-sweep.mjs';
const [build, only] = process.argv.slice(2);
if (!build) throw new Error('Usage: node testing/check-shell.mjs <build> [case-id or prefix*]');
const root = resolve(new URL('../', import.meta.url).pathname);
const html = await readFile(build, 'utf8'), engine = await loadEngine(html);
await mkdir(resolve(root, 'test-results'), { recursive: true });
const dir = await mkdtemp(resolve(root, 'test-results/shell-focused-'));
const browser = await chromium.launch();
try {
  const results = await shellSweep({ root, html, engine, browser, dir, only });
  if (!results.length) throw new Error('No shell cases matched');
  await writeFile(resolve(dir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`Evidence: ${dir}`);
  for (const r of results.filter(r => r.status !== 'passed')) console.error(r.id, r.error || r.checks.filter(c => !c.pass));
  process.exitCode = results.every(r => r.status === 'passed') ? 0 : 1;
} finally { await browser.close(); }
