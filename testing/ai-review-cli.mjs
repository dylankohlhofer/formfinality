#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { exportReview, importReview, canonicalReviewJSON, parseReviewJSON, REVIEW_LIMITS,
  buildReviewBundle, reviewChoiceRequest, validateReviewChoice } from './ai-review.mjs';

// JSON-only stdout for a local process boundary. This CLI never invokes a model
// or writes a report, expectation, recording, source receipt, or app file.
const usage = 'Usage: ai-review-cli.mjs bundle --input <review-input.json> | choice-request --input <review-input.json> [--page N] | choice-import --input <review-input.json> --response <choice.json> --request-id <id> [--page N] | export --report <report.json> --source <review-source.json> | import --report <report.json> --source <review-source.json> --package <review-evidence.json> --response <review-selection.json>';
async function boundedInput(path, limit) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Input is not a bounded regular file');
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = await handle.read(bytes, count, bytes.length - count, null);
      if (!read.bytesRead) break; count += read.bytesRead;
    }
    if (count !== stat.size) throw new Error('Input changed while reading');
    return bytes.subarray(0, count);
  } finally { await handle.close(); }
}
try {
  const [command, ...args] = process.argv.slice(2);
  const contracts = {
    export: ['--report', '--source'], import: ['--report', '--source', '--package', '--response'],
    bundle: ['--input'], 'choice-request': ['--input'], 'choice-import': ['--input', '--response', '--request-id']
  };
  const required = contracts[command]; if (!required) throw new Error(usage);
  const allowed = [...required, ...(command.startsWith('choice-') ? ['--page'] : [])];
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!allowed.includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--')) throw new Error(usage);
    options[key] = value;
  }
  if (!required.every(k => Object.hasOwn(options, k))) throw new Error(usage);
  const paths = { reportPath: options['--report'], sourcePath: options['--source'], packagePath: options['--package'], responsePath: options['--response'] };
  let result;
  if (options['--input']) {
    // A single explicit JSON input carries bytes, never paths to auto-ingest.
    const input = parseReviewJSON(await boundedInput(options['--input'], REVIEW_LIMITS.totalBytes * 2), REVIEW_LIMITS.totalBytes * 2);
    if (!input || Object.keys(input).sort().join(',') !== 'manifest,reportBytes,syntheticAttestation') throw new Error('Invalid review input fields');
    const bundle = await buildReviewBundle(input);
    if (options['--page'] !== undefined && !/^(0|[1-9]\d*)$/.test(options['--page'])) throw new Error('Invalid page');
    const page = Number(options['--page'] ?? 0);
    result = command === 'bundle' ? bundle : command === 'choice-request' ? reviewChoiceRequest(bundle, { page }) :
      validateReviewChoice(await boundedInput(options['--response'], REVIEW_LIMITS.responseBytes), bundle, options['--request-id'], { page });
  } else result = await (command === 'export' ? exportReview(paths) : importReview(paths));
  process.stdout.write(canonicalReviewJSON(result) + '\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
