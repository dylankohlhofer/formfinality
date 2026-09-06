import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const hasScreenshot = (result, check) => result.mode !== 'engine' && check.step != null && !check.path;
export function findings(results) {
  return results.flatMap(r => {
    if (r.status === 'blocked') return [{ kind: 'coverage gap', case: r.id, detail: r.reason }];
    if (r.error) return [{ kind: 'execution error — needs triage', case: r.id, detail: r.error }];
    return [...(r.concerns || []).map(c => ({ kind: 'voice review candidate — human judgement needed', case: r.id, detail: c.detail, ms: c.ms })),
      ...(r.audioGaps || []).map(detail => ({ kind: 'coverage gap', case: r.id, detail })),
      ...(r.checks || []).filter(c => !c.pass).map(c => ({ kind: 'assertion failure — bug candidate',
      case: r.id, detail: c.label, step: c.step, actual: c.actual, expected: c.expected,
      reproduced: r.reproduced ?? false }))];
  });
}
export async function report(dir, run) {
  run.findings = findings(run.results);
  await writeFile(resolve(dir, 'report.json'), JSON.stringify(run, null, 2));
  const cards = run.results.map(r => `<section><h2>${escape(r.id)} — ${escape(r.status)}</h2>
    <p>${escape(r.description || r.reason || '')}</p>
    ${r.error ? `<pre>${escape(r.error)}</pre>` : ''}
    ${r.audio ? `<p><a href="${escape(r.evidence)}/audio-review.html">Listen and review the speech timeline</a></p><audio controls preload="none" src="${escape(r.evidence)}/audio.webm"></audio>
      <p>${escape(r.concerns?.length || 0)} voice review candidates. ${escape((r.audioGaps || []).join(' '))}</p>` : ''}
    ${r.evidence ? `<p><a href="${escape(r.evidence)}/result.json">Full results &amp; effects</a> · <a href="${escape(r.evidence)}/scenario.json">Test case</a></p>` : ''}
    ${r.evidence && r.movement && r.mode === 'engine' ? `<p><a href="${escape(r.evidence)}/events.json">Engine inputs and sampled event evidence</a></p>` : ''}
    ${r.evidence && r.mode !== 'engine' ? `<p><a href="${escape(r.evidence)}/trace.zip">Browser trace</a> · <a href="${escape(r.evidence)}/console.json">Console and exceptions</a></p>` : ''}
    <ul>${(r.checks || []).map(c => `<li>${c.pass ? 'PASS' : 'FAIL'}: ${escape(c.label)}${c.pass ? '' : `<pre>Expected: ${escape(JSON.stringify(c.expected))}\nActual: ${escape(JSON.stringify(c.actual))}</pre>`}
      ${hasScreenshot(r, c) ? `<a href="${escape(r.evidence)}/step-${c.step}.png">Screenshot</a>` : ''}</li>`).join('')}</ul></section>`).join('');
  const status = cases => !cases.length ? 'not run' : `${cases.filter(c => c.status === 'passed').length}/${cases.length} passed`;
  const board = run.coverage ? `<h2>All-exercise coverage board</h2><p>Engine tests use synthetic geometry. Browser tests use test-only single-exercise plans and the original UI. No human recording is implied by a pass.</p>
    <table><thead><tr><th>Exercise</th><th>Engine</th><th>Browser</th><th>Human video</th></tr></thead><tbody>
    ${run.coverage.map(c => `<tr><td>${escape(c.name)}<br><small>${escape(c.tiers.join(', '))}</small></td>
      <td>${escape(status(c.engine))}<details><summary>Cases</summary>${c.engine.map(r => `<p><a href="${escape(r.evidence)}/result.json">${escape(r.tier)}: ${escape(r.status)}</a></p>`).join('')}</details></td>
      <td>${escape(status(c.browser))}<details><summary>Evidence</summary>${c.browser.map(r => `<p><a href="${escape(r.evidence)}/result.json">${escape(r.id)}: ${escape(r.status)}</a></p>`).join('')}</details></td>
      <td>Not tested<details><summary>Gaps</summary>${c.limitations.map(l => `<p>${escape(l)}</p>`).join('')}<p>${escape(c.devices)}</p></details></td></tr>`).join('')}</tbody></table>` : '';
  await writeFile(resolve(dir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Form Coach test review</title>
    <style>body{font:16px/1.5 system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#222}section{border-top:1px solid #bbb;padding:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#534693}li{margin:8px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #bbb;padding:10px;vertical-align:top}small{font-size:12px}details{max-width:300px;overflow-wrap:anywhere}</style>
    <h1>Form Coach — ${escape(run.status)}</h1><p>${escape(run.started)} · build ${escape(run.build)}<br>SHA-256 ${escape(run.buildHash)}</p>
    <p>Assertions identify reproducible disagreements, not automatically verified product bugs. Review the expectation and evidence before changing behaviour.</p>
    ${board}<h2>Coverage boundaries</h2><ul>${run.limitations.map(x => `<li>${escape(x)}</li>`).join('')}</ul>${cards}</html>`);
  const lines = run.findings.length ? run.findings.map(f => `- **${f.kind}** · ${f.case}: ${f.detail}${f.step == null ? '' : ` (step ${f.step})`}`) : ['- No failures in the checks executed.'];
  await writeFile(resolve(dir, 'REVIEW.md'), `# Test review\n\n${run.status} · ${run.started}\n\n${lines.join('\n')}\n\n## Review contract\n\nCheck the saved scenario and oracle, then screenshots/trace and actual outputs. Classify each failure as app bug, test bug, environment issue or unresolved. Do not update expected results simply to get green. Product semantics and real-person usability still require human review.\n`);
}
