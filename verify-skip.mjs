#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Form Coach — verify-skip.mjs

   The only coverage `SessionCore.skip` and `CalibrationCore.skip` have.

   WHY THIS EXISTS: the conformance vectors do not reach either core's skip path
   and cannot be made to — a skip is an INTERRUPTION, not a recorded frame
   sequence, so there is no timeline to replay and no output to have recorded.
   Every assertion below is therefore a DERIVED property, the same shape of
   argument `verify-draw.mjs` makes: there is nothing recorded here to drift
   from, only invariants that must hold.

   The invariant this suite exists to protect, above all the others:

     A SKIPPED PHASE IS NOT A ZERO. A zero is a measurement claim, and for a
     movement nobody performed it is a false one. `score:null, skipped:true` —
     never `score:0` — and the session average must contain only the frames
     actually watched. `scoreSum` accumulates per FRAME in tickRaw, so any
     second accumulation inside a skip double-counts. Section 2 asserts that
     directly, because the double-count is the mistake that was actually made
     while building this and it is invisible in every other harness.

   The two false claims a skip would otherwise let the debrief make are here as
   well, because both were reachable and neither is caught by a vector:

     · "Nothing to fix — you held the shapes well" for a session that was
       skipped straight through. Skipped phases raise no insights, so the old
       `nothingWrong = !lead` was true. Section 1.
     · "AVG FORM 0" when scoreN never left 0 — the same zero, one tile over.
       Section 1.

   Fixture assumptions are asserted, not assumed: the plan, the pose and the
   rest step are all checked by name before anything depends on them, so a
   content edit that moves them fails HERE rather than silently gutting a
   section (rule 4 — fail loudly).

   USAGE
     node verify-skip.mjs path/to/build.html   # the build is REQUIRED, never defaulted

   EXIT CODE 0 = both skip paths behave. Non-zero = a divergence, named.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { pathToFileURL } from "url";

const BUILD = process.argv[2];
if(!BUILD){ console.error("usage: node verify-skip.mjs <build.html>"); process.exit(2); }
const VECTORS = "conformance-vectors.json";

/* ── extract the engine from the single-file build ──────────────────────── */
const html = readFileSync(BUILD, "utf8");
const js = html.split('<script type="module">')[1]?.split("</script>")[0];
if(!js) throw new Error(`no module script found in ${BUILD}`);
const start = js.indexOf("const TIERS"), end = js.indexOf("const VERSION");
if(start < 0 || end < 0 || end <= start)
  throw new Error("engine boundaries not found — has the build structure changed?");
const tmp = `./.skip-${process.pid}.mjs`;
writeFileSync(tmp, js.slice(start, end) +
  `\nexport { M, PLANS, TIERS, SessionCore, CalibrationCore };`);
let E;
try { E = await import(pathToFileURL(tmp).href); }
finally { try { unlinkSync(tmp); } catch {} }

/* Poses and the frame step come from the SAME json every other harness reads, so
   a synthetic pose can never drift between suites. */
const V = JSON.parse(readFileSync(VECTORS, "utf8"));
const DT = V.meta?.dt ?? 1/30;

/* ── reporting — house style: one line per section, failures named ───────── */
let pass = 0, fail = 0;
const fails = [];
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok){ pass++; return true; }
  fail++;
  fails.push(`${label}\n      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`);
  return false;
};
let secBefore = 0, secName = "", secN = 0;
const section = (name, n) => { secBefore = fail; secName = name; secN = n; };
const done = note => {
  process.stdout.write(`  ${secName.padEnd(22)} ${String(secN).padStart(4)} checks  … `);
  console.log(fail === secBefore ? `ok${note ? ` (${note})` : ""}` : `${fail - secBefore} FAILED`);
};

/* ── fixtures, asserted by name ──────────────────────────────────────────── */
const PLAN_ID = "first-steps", POSE_ID = "plank";
const plan = E.PLANS.find(p => p.id === PLAN_ID);
if(!plan){ console.error(`fixture gone: no plan "${PLAN_ID}" — update this suite deliberately`); process.exit(2); }
if(!V.poses[POSE_ID]){ console.error(`fixture gone: no pose "${POSE_ID}" in ${VECTORS}`); process.exit(2); }
if(!plan.steps.some(s => s.rest != null)){
  console.error(`fixture gone: plan "${PLAN_ID}" has no rest step — section 3 cannot run`); process.exit(2);
}

const env = { speaking: () => false, portrait: () => false, hasDemo: () => true };
const frameFromPose = (j, conf = 0.95) => {
  const side = {};
  for(const k in j) side[k] = { x: j[k][0], y: j[k][1], c: conf };
  return { left: side, right: JSON.parse(JSON.stringify(side)), cam: "left", conf };
};
const PLANK = frameFromPose(V.poses[POSE_ID]);
/* Tick until the evaluator has actually HELD for `secs`, rather than for a fixed
   number of frames: arming costs 1.8s and the tier scales the target, so a frame
   count silently becomes "the whole set" the moment either changes. */
const holdFor = (core, secs, frame = PLANK) => {
  let now = 0, guard = 0;
  while((core.ev?.hold ?? 0) < secs && guard++ < 20000){ now += DT; core.tick(frame, DT, now); }
  return now;
};

console.log(`\nForm Coach — skip-path verification`);
console.log(`build   ${BUILD}`);
console.log(`plan    ${PLAN_ID} (${plan.steps.length} steps) · pose ${POSE_ID} · dt ${DT.toFixed(5)}\n`);

/* ── 1 · a session skipped end to end ────────────────────────────────────── */
{
  section("skipWholeSession", 8);
  const s = new E.SessionCore(plan, "learning", env);
  s.start();
  let payload = null, guard = 0;
  const fx = [];
  while(!s.done && guard++ < 200){
    const out = s.skip("test");
    fx.push(...out);
    const f = out.find(e => e.t === "finish");
    if(f) payload = f.payload;
  }
  check("a skipped-through session still reaches the debrief", !!payload, true);
  const out = payload?.out ?? [];
  check("no phase is scored zero", out.map(o => o.score), out.map(() => null));
  check("every phase is marked skipped", out.every(o => o.skipped === true), true);
  /* THE ZERO, ONE TILE OVER. scoreN never left 0, so there is no average to give;
     0 would be a verdict on a session nobody watched. The shell renders null "—". */
  /* `?? "missing"` would swallow the very null this asserts — the absent case has to
     be told apart from the null case by KEY, not by value. Cost two red checks. */
  check("session average is null, not a zero verdict",
        payload && "avg" in payload ? payload.avg : "missing", null);
  check("a skipped session is NOT told 'nothing to fix'",
        /nothing to fix/i.test(payload?.headline ?? ""), false);
  check("the headline names the skipping instead",
        /skipped everything/i.test(payload?.headline ?? ""), true);
  const logs = fx.filter(e => e.t === "log" && e.row.state === "skipped");
  check("one skipped log row per step (it must reach the CSV)", logs.length, plan.steps.length);
  check("every skipped log row carries the reason", logs.every(r => r.row.cue === "test"), true);
  done("no phase scored, no praise claimed");
}

/* ── 2 · skip after real work — the double-count trap ────────────────────── */
{
  section("skipKeepsWatchedFrames", 5);
  const s = new E.SessionCore(plan, "learning", env);
  s.start();
  holdFor(s, 5);
  const sumBefore = s.scoreSum, nBefore = s.scoreN;
  s.skip("user");
  /* If a skip accumulated the phase average a SECOND time, these two move. The
     per-frame sum in tickRaw is the only accumulation there is, by design. */
  check("scoreSum is untouched by the skip (no second accumulation)", s.scoreSum, sumBefore);
  check("scoreN is untouched by the skip", s.scoreN, nBefore);
  check("the phase is recorded", s.out.length, 1);
  check("recorded as skipped, with a null score",
        [s.out[0]?.skipped ?? null, s.out[0] && "score" in s.out[0] ? s.out[0].score : "missing"],
        [true, null]);
  /* What they DID do still happened — the verdict is withheld, not the measurement. */
  check("what was actually held stays on the row", (s.out[0]?.achieved ?? 0) >= 5, true);
  done(`${nBefore} frames watched, kept exactly once`);
}

/* ── 3 · skipping a REST is only "I'm ready now" ─────────────────────────── */
{
  section("skipRest", 3);
  const s = new E.SessionCore(plan, "learning", env);
  s.start();
  let guard = 0;
  while(s.steps[s.i] && s.steps[s.i].rest == null && guard++ < 200) s.skip("advance");
  const before = s.out.length, i0 = s.i;
  const fx = s.skip("rest");
  check("the rest step advances", s.i > i0, true);
  check("no phase row is added for a rest", s.out.length, before);
  check("the rest skip is logged as a rest", fx.find(e => e.t === "log")?.row.phase ?? null, "rest");
  done("advanced, nothing recorded");
}

/* ── 4 · CalibrationCore — the mid-hold escape hatch ─────────────────────── */
{
  section("calibrationSkip", 7);
  const c = new E.CalibrationCore(env);
  holdFor(c, 5);
  check("armed before the skip", c.armed, true);
  const held = c.ev.hold;
  const fx = c.skip();
  const v = fx.find(e => e.t === "calibFinish");
  /* THE POINT OF THIS SECTION: whatever they held still counts. Discarding it
     would leave a beginner with nothing at the exact moment they told us the
     movement was too hard. */
  check("a verdict is produced, not nothing", !!v, true);
  check("the verdict is Learning", v?.payload.tierId ?? null, "learning");
  check("the hold is kept, not discarded", v?.payload.held ?? null, held);
  check("held is the ~5s they actually managed",
        (v?.payload.held ?? 0) >= 5 && (v?.payload.held ?? 0) < 8, true);
  check("the skip is logged", !!fx.find(e => e.t === "log" && e.row.state === "skipped"), true);
  check("a second skip is a no-op", c.skip().length, 0);
  check("copy names the seconds they held",
        new RegExp(`held ${Math.round(held)} second`).test(v?.payload.copy ?? ""), true);
  done(`${held.toFixed(1)}s held → learning`);
}

/* ── 5 · skip outside a running step ─────────────────────────────────────── */
{
  section("skipOutsideAStep", 2);
  const s = new E.SessionCore(plan, "learning", env);
  check("skip before start() emits nothing", s.skip("x").length, 0);
  s.start();
  let guard = 0; while(!s.done && guard++ < 200) s.skip("x");
  check("skip after the debrief emits nothing", s.skip("x").length, 0);
  done("no-ops, silently and safely");
}

console.log(`\n  ${pass} passed · ${fail} failed`);
if(fails.length){
  console.log(`\n  ${Math.min(fails.length, 10)} of ${fail} failure(s):\n`);
  for(const f of fails.slice(0, 10)) console.log("   " + f + "\n");
}
console.log(fail === 0
  ? "\n✅ a skipped phase is recorded as not attempted, never as a zero\n"
  : "\n❌ the skip paths diverged — fix the build, not this suite\n");
process.exit(fail === 0 ? 0 : 1);
