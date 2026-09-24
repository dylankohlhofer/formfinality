#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hash, validate, validateRecording, loadEngine, fixtures, engineAdapter, runTimeline, runExitCode } from './lib.mjs';
import { runBrowser } from './browser.mjs';
import { report } from './report.mjs';
import { librarySweep } from './library.mjs';
import { audioSweep } from './audio-sweep.mjs';
import { selectPack } from './packs.mjs';
import {syntheticReviewSource,exportReview,canonicalReviewJSON} from './ai-review.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!['--build', '--mode', '--scenario', '--scenario-file', '--pack', '--landmarks', '--recording', '--require-video', '--library-only'].includes(key)) throw new Error(`Unknown argument ${key}`);
  if (key === '--require-video') options.requireVideo = true;
  else if (key === '--library-only') options.libraryOnly = true;
  else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`); options[key.slice(2)] = args[++i]; }
}
if (!options.build) throw new Error('Usage: node testing/run.mjs --build <build.html> [--mode all|engine|browser|video|audio] [--scenario id | --pack id] [--recording private-file.mp4] [--require-video]');
options.mode ??= 'all';
if (options.pack && (!/^[a-z0-9-]+$/.test(options.pack) || options.scenario || options['scenario-file'] ||
    options.libraryOnly || options.mode === 'audio')) throw new Error('A named pack cannot be combined with scenario, scenario-file, library-only or audio selection');
if (!['all', 'engine', 'browser', 'video', 'audio'].includes(options.mode)) throw new Error('Unknown mode');
if(options.requireVideo && (!['all','video'].includes(options.mode) || options.libraryOnly)){
  console.error('--require-video requires scenario video coverage: use --mode all or video, without --library-only.');
  process.exit(2);
}
if (options.mode === 'audio' && (options.recording || options.landmarks || options['scenario-file'] || options.libraryOnly))
  throw new Error('Audio uses committed wall-clock cases: optionally select --scenario <audio-case-id>. Video/landmark inputs are not supported in this mode yet.');
if ((options.recording || options.landmarks) && !(options.scenario || options['scenario-file'])) throw new Error('A recording must name its scenario');
if (options.landmarks && options.mode !== 'engine') throw new Error('--landmarks is an engine replay input; specify --mode engine');
if (options.scenario && options['scenario-file']) throw new Error('Choose --scenario or --scenario-file, not both');
if (options.libraryOnly && (options.scenario || options['scenario-file'] || options.mode === 'video')) throw new Error('--library-only cannot select a scenario or video mode');
const html = await readFile(resolve(options.build), 'utf8');
const buildHash = hash(html), started = new Date().toISOString();
const dir = resolve(root, 'test-results', started.replace(/[:.]/g, '-') + '-' + process.pid);
await mkdir(dir, { recursive: true });
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const run = { started, build: basename(options.build), buildHash, commit: git.status === 0 ? git.stdout.trim() : null,
  origin:options.recording || options.landmarks || options['scenario-file'] ? 'external' : 'synthetic',
  node: process.version, platform: `${process.platform}/${process.arch}`, results: [], limitations: [
    'Landmark browser mode bypasses webcam acquisition, model inference, animation scheduling and actual audio. It exercises original UI handlers, engine effects and debrief.',
    'Recorded-video mode uses real MediaPipe CPU inference and the original rendering loop, but replaces the webcam with a file and controls frame timing. It does not validate device GPU performance.',
    'Desktop and narrow Chromium viewports are not physical iOS/Android coverage. Screenshots are evidence for review, not an AI judgement that a demonstration teaches a movement correctly.',
    'No automated mode proves beginner comprehension, comfort, coaching safety or real-world accuracy. Beginner test 02 remains a release gate.',
    'No cloud AI/API calls, uploads, automatic app edits or changes to expected outputs occur in this runner. MediaPipe inference runs locally.'
  ] };
run.limitations.push('External web fonts are removed in the offline test copy; screenshots use the app fallback fonts. Voice is disabled in accelerated landmark/video cases. Dedicated audio cases capture real decoded media-element output at wall-clock speed, not hardware speakers or native TTS waveforms.');
run.limitations.push('The library sweep adds original camera-handler tests with a fake stream, and original Coach/AudioBank queue tests with simulated completion events. These do not validate physical hardware, actual sound, or webcam pose accuracy.');
await writeFile(resolve(dir, 'build.html'), html);
run.fixtureHash = hash(await readFile(resolve(root, 'conformance-vectors.json')));
run.lockfileHash = hash(await readFile(resolve(root, 'package-lock.json')));
run.bridgeHash = hash(await readFile(resolve(root, 'testing/bridge.js')));
run.summaryFixtureHash = hash(await readFile(resolve(root, 'testing/summary-selection-vectors.json')));
run.coachChoiceFixtureHash = hash(await readFile(resolve(root,'testing/coach-choice-vectors.json')));
run.coachCommandFixtureHash = hash(await readFile(resolve(root,'testing/coach-command-vectors.json')));
run.clipResolutionFixtureHash = hash(await readFile(resolve(root,'testing/clip-resolution-vectors.json')));
run.movementEvidenceFixtureHash = hash(await readFile(resolve(root,'testing/movement-evidence-vectors.json')));
run.testSourceHashes = {};
for (const name of (await readdir(resolve(root, 'testing'))).filter(n => /\.(mjs|js)$/.test(n)))
  run.testSourceHashes[name] = hash(await readFile(resolve(root, 'testing', name)));
for (const name of (await readdir(resolve(root, 'duo'))).filter(name => name.endsWith('.mjs')))
  run.testSourceHashes[`duo/${name}`] = hash(await readFile(resolve(root, 'duo', name)));
for (const folder of ['release', 'commercial'])
  for (const name of (await readdir(resolve(root, folder))).sort())
    run.testSourceHashes[`${folder}/${name}`] = hash(await readFile(resolve(root, folder, name)));
if (options.mode === 'all') {
  for (const suite of ['coach-regressions', 'review-regressions', 'adversarial', 'architecture', 'audio-stalls', 'voice-audit', 'setup-prompt', 'diagnostics', 'references', 'worker-queue', 'reported-session', 'movement-evidence', 'evidence-parity', 'partial-visibility', 'body-tolerance', 'interface', 'summary', 'interaction', 'local-coach', 'profile-goals', 'duo-sync', 'local-command-listener', 'ai-review', 'review-workflow', 'web-release', 'economics']) {
    const checked = spawnSync(process.execPath, ['--test', `testing/${suite}.test.mjs`], {
      cwd: root, encoding: 'utf8', timeout: 120000, env: { ...process.env, FORM_COACH_TEST_BUILD: resolve(dir, 'build.html') }
    });
    await writeFile(resolve(dir, `${suite}.log`), (checked.stdout || '') + (checked.stderr || ''));
    run.results.push({ id: suite, mode: 'regression', status: checked.status === 0 ? 'passed' : 'failed',
      checks: [{ label: `${suite} passes against this saved run`, pass: checked.status === 0,
        actual: checked.status, expected: 0 }], error: checked.error?.message });
  }
  for (const suite of ['verify.mjs', 'verify-mutations.mjs', 'verify-draw.mjs', 'verify-skip.mjs']) {
    const checked = spawnSync(process.execPath, [suite, resolve(dir, 'build.html')], { cwd: root, encoding: 'utf8', timeout: 120000 });
    await writeFile(resolve(dir, suite + '.log'), (checked.stdout || '') + (checked.stderr || ''));
    run.results.push({ id: suite, mode: 'legacy', status: checked.status === 0 ? 'passed' : 'failed',
      checks: [{ label: `${suite} exits successfully`, pass: checked.status === 0, actual: checked.status, expected: 0 }],
      error: checked.error?.message });
  }
}
const frameFor = await fixtures(new URL('./', import.meta.url));
const engine = await loadEngine(html);
const files = (await readdir(resolve(root, 'testing/scenarios'))).filter(f => f.endsWith('.json')).sort();
let scenarios = [];
for (const file of options['scenario-file'] ? [resolve(options['scenario-file'])] : files.map(f => resolve(root, 'testing/scenarios', f))) {
  const s = validate(JSON.parse(await readFile(file, 'utf8')));
  if (!options.scenario || s.id === options.scenario) scenarios.push(s);
}
if (!scenarios.length && options.mode !== 'audio') throw new Error('No matching scenario');
if (options.pack) {
  const pack = JSON.parse(await readFile(resolve(root, 'testing/packs', options.pack + '.json'), 'utf8'));
  scenarios = selectPack(pack, scenarios, options.pack);
  run.pack = pack; run.packHash = hash(JSON.stringify(pack));
  run.limitations.push(...pack.limitations);
  await writeFile(resolve(dir, 'pack.json'), JSON.stringify(pack, null, 2));
}
const modes = options.mode === 'all' ? ['engine', 'browser', 'video'] : [options.mode];
for (const scenario of options.libraryOnly || options.mode === 'audio' ? [] : scenarios) for (const mode of modes) {
  if (mode === 'video' && !options.recording) {
    run.results.push({ id: `${scenario.id}/video`, mode, status: 'blocked', reason: 'No consented recording supplied. Synthetic pose fixtures are not real-video validation.' });
    continue;
  }
  const views = mode === 'browser' ? [{ width: 1280, height: 800 }, { width: 390, height: 844 }] : [{ width: 1280, height: 800 }];
  for (const viewport of views) {
    const id = `${scenario.id}/${mode}${mode === 'browser' ? '-' + viewport.width : ''}`;
    const evidence = id.replaceAll('/', '-');
    const caseDir = resolve(dir, evidence); await mkdir(caseDir);
    await writeFile(resolve(caseDir, 'scenario.json'), JSON.stringify(scenario, null, 2));
    const execute = async target => {
      if (mode === 'engine') {
        let frames;
        if (options.landmarks) {
          const input = await readFile(resolve(options.landmarks), 'utf8');
          frames = validateRecording(JSON.parse(input), scenario);
          await writeFile(resolve(target, 'landmarks.json'), input);
        }
        const adapter = engineAdapter(engine, scenario, frameFor, frames);
        return { ...await runTimeline(scenario, adapter), effects: adapter.effects };
      }
      if (mode === 'video') {
        const model = await readFile(resolve(root, 'testing/assets/pose_landmarker_lite.task'));
        const manifest = JSON.parse(await readFile(resolve(root, 'testing/model.json')));
        if (hash(model) !== manifest.sha256) throw new Error('Pose model checksum mismatch');
        await stat(resolve(options.recording));
      }
      return runBrowser({ root, html, scenario, frameFor, dir: target, viewport,
        recording: mode === 'video' ? resolve(options.recording) : undefined });
    };
    let result;
    try {
      result = await execute(caseDir);
      result.status = result.checks.every(c => c.pass) ? 'passed' : 'failed';
      if (result.status === 'failed') {
        const retryDir = resolve(caseDir, 'reproduction'); await mkdir(retryDir);
        try {
          const again = await execute(retryDir);
          await writeFile(resolve(retryDir, 'result.json'), JSON.stringify(again, null, 2));
          const failures = r => r.checks.filter(c => !c.pass).map(c => ({ label: c.label, actual: c.actual }));
          result.reproduced = JSON.stringify(failures(result)) === JSON.stringify(failures(again));
        } catch (error) { result.reproduced = false; result.reproductionError = error.message; }
      }
    } catch (error) { result = { status: 'error', error: error.stack }; }
    Object.assign(result, { id, mode, evidence, description: scenario.description, scenarioHash: hash(JSON.stringify(scenario)),
      coverageGaps: scenario.coverageGaps || [] });
    if (mode === 'video') {
      try { result.recordingHash = hash(await readFile(resolve(options.recording))); }
      catch (error) { result.recordingError = error.message; }
    }
    await writeFile(resolve(caseDir, 'result.json'), JSON.stringify(result, null, 2));
    run.results.push(result);
    console.log(`${result.status.toUpperCase()} ${id}: ${result.checks?.filter(c => c.pass).length ?? 0}/${result.checks?.length ?? 0} checks`);
    // Write incrementally so evidence already collected survives later failures.
    run.status = 'running'; await report(dir, run);
  }
}
if (!options.pack && !options.scenario && !options['scenario-file'] && !['video', 'audio'].includes(options.mode)) {
  run.coverage = await librarySweep({ root, html, engine, frameFor, dir, mode: options.mode,
    onResult: async result => {
      run.results.push(result); run.status = 'running';
      if (run.results.length % 10 === 0) await report(dir, run);
    } });
  await writeFile(resolve(dir, 'coverage.json'), JSON.stringify(run.coverage, null, 2));
  run.results.push({ id: 'exercise-library/video', mode: 'video', status: 'blocked', reason: 'All 21 exercises still need consented human recordings with independently reviewed expectations.' });
}
if (options.mode === 'audio' || options.mode === 'all' && !options.pack && !options.scenario && !options['scenario-file'] && !options.libraryOnly) {
  await audioSweep({ root, html, dir, only: options.mode === 'audio' ? options.scenario : undefined,
    onResult: async result => { run.results.push(result); } });
}
const failed = run.results.some(r => ['failed', 'error'].includes(r.status));
const blocked = run.results.some(r => r.status === 'blocked');
const audioGap = run.results.some(r => r.audioGaps?.length);
const recognitionGap = run.results.some(r => r.coverageGaps?.length);
run.status = failed ? 'failed' : blocked || audioGap || recognitionGap ? 'passed checks; ' +
  [blocked && 'video', audioGap && 'audio', recognitionGap && 'recognition'].filter(Boolean).join(' and ') + ' coverage incomplete' : 'passed checks';
await report(dir, run);
// Only the trusted runner can attest these input paths. Never backfill receipts
// for old reports or export a private recording/landmark/external scenario run.
let reviewFailed = false;
if(!options.recording && !options.landmarks && !options['scenario-file'] && options.mode !== 'video'){
  try {
    const reportPath=resolve(dir,'report.json'),sourcePath=resolve(dir,'review-source.json');
    const source=syntheticReviewSource(await readFile(reportPath),{inputKind:'synthetic',recording:false,landmarks:false,scenarioSource:'repository'});
    await writeFile(sourcePath,JSON.stringify(source,null,2));
    const evidence=await exportReview({reportPath,sourcePath});
    await writeFile(resolve(dir,'review-evidence.json'),canonicalReviewJSON(evidence));
    await writeFile(resolve(dir,'review-status.json'),JSON.stringify({status:'not-requested',humanReviewRequired:true,accuracyVerdict:'not-assessed',candidates:evidence.candidates.length},null,2));
    console.log(`Local review evidence: ${evidence.candidates.length} candidates; AI not requested. Coverage gaps remain open.`);
  } catch(error){
    reviewFailed=true;
    await writeFile(resolve(dir,'review-status.json'),JSON.stringify({status:'export-failed',message:error.message},null,2));
    console.error(`Local review evidence export failed: ${error.message}`);
  }
}
await writeFile(resolve(root, 'test-results/LATEST.txt'), relative(root, dir) + '\n');
console.log(`Review: ${resolve(dir, 'index.html')}`);
process.exitCode = runExitCode(run.results,{requireVideo:options.requireVideo,mode:options.mode,reviewFailed});
