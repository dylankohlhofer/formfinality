#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Form Coach — verify.mjs

   Replays the conformance vectors against the browser engine. This is the
   browser-side twin of `swift test`: the same 1,891 recorded cases, checked
   against the same specification.

   WHY THIS EXISTS: the original 17 ad-hoc test suites lived only in an
   ephemeral sandbox and were lost when it reset. The vectors survived, and
   they hold the valuable half — the expected outputs. This harness is a
   better shape than what it replaces: one file, one source of truth, and it
   cannot drift from the Swift tests because both read the same JSON.

   USAGE
     node verify.mjs path/to/build.html   # the build is REQUIRED, never defaulted

   The build argument has no default on purpose. It used to fall back to
   form-coach-v4.8.html, so a bare `node verify.mjs` silently graded v4.9-recorded
   vectors against the v4.8 build — a green run that proved nothing about the build
   anyone was actually editing. Fail loudly (rule 4).

   EXIT CODE 0 = every vector matches. Non-zero = a divergence, named.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { pathToFileURL } from "url";

const BUILD = process.argv[2];
if (!BUILD) { console.error("usage: node verify.mjs <build.html>"); process.exit(2); }
const VECTORS = "conformance-vectors.json";
const CONTENT = "content-v4.8.json";

/* ── extract the engine from the single-file build ──────────────────────── */
function loadEngine(buildPath){
  const html = readFileSync(buildPath, "utf8");
  const js = html.split('<script type="module">')[1]?.split("</script>")[0];
  if(!js) throw new Error(`no module script found in ${buildPath}`);
  const start = js.indexOf("const TIERS");
  const end   = js.indexOf("const VERSION");
  if(start < 0 || end < 0) throw new Error("engine boundaries not found — has the build structure changed?");
  const src = js.slice(start, end) + `
export { TIERS, M, PLANS, BASE, TIER_LINES, PERSONAS, Evaluator, Rep, scoreTarget,
         cueFor, readMetric, expandPlanSteps, REF, refPose, buildFrame, SessionCore,
         CalibrationCore, resolveMovementCore, scaledCore, sessionInsights,
         PORTRAIT_OK, emaAlpha, REF_DT, tintSegs, framing, neededJoints };`;
  const tmp = `./.engine-${process.pid}.mjs`;
  writeFileSync(tmp, src);
  return { tmp, url: pathToFileURL(tmp).href };
}

const { tmp, url } = loadEngine(BUILD);
let E;
try { E = await import(url); }
finally { try { unlinkSync(tmp); } catch {} }

const V = JSON.parse(readFileSync(VECTORS, "utf8"));
const C = JSON.parse(readFileSync(CONTENT, "utf8"));
const DT = V.meta?.dt ?? 1/30;

/* ── tolerances — one source of truth ─────────────────────────────────────
   Every numeric slack lives in meta.tolerances and BOTH harnesses read it from
   there. They used to be split: hardcoded inline here (1.5 for scoreTarget,
   5e-5 for filters) and read from meta in Swift (score: 1.0). The two drifted,
   and the same ten scoreTarget rows passed here while failing in Swift — a
   divergence report that was really a tolerance report. A missing tolerance is
   an error, not a default: silently grading at 1e-6 is how this started. */
const tol = k => {
  const t = V.meta?.tolerances?.[k];
  if(typeof t !== "number"){
    console.error(`meta.tolerances.${k} missing from ${VECTORS} — cannot verify`);
    process.exit(2);
  }
  return t;
};

/* ── reporting ──────────────────────────────────────────────────────────── */
let pass = 0, fail = 0;
/* Failures are budgeted PER SECTION, not globally. A single global cap of 25 meant a
   noisy early section could starve every later one: reviewing v4.8, `refGates` reported
   "14 FAILED" and printed nothing at all, because `scoreTarget` had already spent the
   budget. The one time the detail was wanted, it wasn't there. A section's job is to
   name what broke, so each gets its own allowance. */
const FAILS_PER_SECTION = 8;
const failures = new Map();          // section → [detail]
const near = (a, b, tol = 1e-6) =>
  (a == null && b == null) || (typeof a === "number" && typeof b === "number"
    ? Math.abs(a - b) <= tol : a === b);

function check(section, label, got, want, tol){
  if(near(got, want, tol)){ pass++; return true; }
  fail++;
  if(!failures.has(section)) failures.set(section, []);
  const seen = failures.get(section);
  if(seen.length < FAILS_PER_SECTION)
    seen.push(`${section} · ${label}\n      expected ${want}\n      got      ${got}`);
  return false;
}
const section = (name, n) => process.stdout.write(`  ${name.padEnd(20)} ${String(n).padStart(5)} vectors … `);
const done = (before) => console.log(fail === before ? "ok" : `${fail - before} FAILED`);

/* ── frame helpers ──────────────────────────────────────────────────────── */
const frameFromPose = (j, conf = 0.95) => {
  const side = {};
  for(const k in j) side[k] = { x: j[k][0], y: j[k][1], c: conf };
  return { left: side, right: JSON.parse(JSON.stringify(side)), cam: "left", conf };
};

console.log(`\nForm Coach — vector verification`);
console.log(`build   ${BUILD}`);
console.log(`vectors ${VECTORS} (${Object.values(V).filter(Array.isArray).reduce((a,x)=>a+x.length,0)} rows)\n`);

/* ── 1 · scoreTarget ────────────────────────────────────────────────────── */
{
  const b = fail; section("scoreTarget", V.scoreTarget.length);
  for(const r of V.scoreTarget){
    const mv = E.M[r.movement];
    const t  = mv?.targets.find(x => x.id === r.target);
    if(!t){ check("scoreTarget", `${r.movement}.${r.target}`, "missing target", "present"); continue; }
    /* r.v is stored at 3dp but the generator scored it at full precision, so
       quantisation alone can move the score ~1.16–1.49 points near the falloff
       edge (verified: recorded scores match tol×2.185 exactly). meta.tolerances
       .score absorbs that without masking a real drift — see README-verify.md,
       category 3. */
    check("scoreTarget", `${r.movement}.${r.target}@${r.tier} v=${r.v}`,
          +E.scoreTarget(t, r.v, r.tier).toFixed(4), +r.score.toFixed(4), tol("score"));
    if(r.cue !== undefined)
      check("scoreTarget", `${r.movement}.${r.target}@${r.tier} v=${r.v} cue`,
            E.cueFor(t, r.v, r.tier) ?? null, r.cue ?? null);
  }
  done(b);
}

/* ── 2 · readMetric ─────────────────────────────────────────────────────── */
{
  const b = fail; section("readMetric", V.readMetric.length);
  for(const r of V.readMetric){
    const mv = E.M[r.movement];
    const t  = mv?.targets.find(x => x.id === r.target);
    const ref = E.REF[r.movement];
    if(!t || !ref){ check("readMetric", `${r.movement}.${r.target}`, "missing", "present"); continue; }
    const f = ref.frames[r.frame];
    const pose = {}; for(const k in f){ if(k === "spine") continue; pose[k] = f[k]; }
    const got = E.readMetric(t.m, frameFromPose(pose), "left");
    check("readMetric", `${r.movement}.${r.target} frame ${r.frame}`,
          got == null ? null : +got.toFixed(4), r.v == null ? null : +r.v.toFixed(4), tol("value"));
  }
  done(b);
}

/* ── 2b · refGates — a demo must pass the exercise it demonstrates ───────────
   THE HOLE THIS CLOSES. `gen-refs.mjs` used to assert exactly this and was lost with
   the sandbox; the assertion was never carried into any harness, while three documents
   went on crediting it as a live test category. In that gap `crunch` (#40) and then
   `glute-bridge`, `dead-bug` and `leg-raise-bent` (#41) drifted into teaching poses the
   app refuses to start from — a demo showing a knee folded to 4° while the movement's
   own position gate demands ~95°. Every one was found by a person looking, not by a test.

   Unlike every other section here this one is DERIVED, not vector-driven: there is no
   recorded expectation, only the movement's own targets. That is the point — it stays
   true across deliberate vector regenerations, and it fails on a REF edit that no
   recorded row would notice.

   WHY EVERY FRAME, not just the taught pose. The obvious form of this check — assert the
   final frame, the one the demo is teaching — would NOT have caught #41. `glute-bridge`
   was broken in frame 0 and clean in frame 1; `dead-bug` likewise, and its frame 1 is a
   documented exception. A final-frame-only check would have passed the broken build on
   two of the three movements. So: every frame, with the frames that deliberately start
   outside the pose named individually below.

   Read through `Evaluator.read`, so `agg` (best/worst/mean) resolves exactly as a live
   session resolves it, at LEARNING tier — the widest tolerance band, and the tier these
   demos exist for. A gate that cannot clear the widest band is broken at every tier. */
const REF_TIER = "learning";

/* A folded-flat limb is a DRAWING failure before it is a gate failure: `drawRef` paints
   thigh and shin as capsules, so a shin doubled back over its thigh renders as one bar
   whatever the gates say. Caught on knee angle, which is what "folded" actually means —
   perpendicular separation can't be used, because a STRAIGHT leg (plank, 180°) has none
   either and is perfectly correct. Floor at 25°: the bug frames read 3.9–10.0°, and the
   lowest legitimate demo is crunch at 47.4°, so this sits ~2x clear of both. */
const REF_FOLD_FLOOR = 25;
const KNEE_FOLD = { k:"angle", v:"knee", a:"hip", c:"ankle" };

/* ── the exceptions ───────────────────────────────────────────────────────────
   Each is asserted BOTH WAYS: it must still refer to something real, and the thing it
   excuses must still be failing. An exception that starts passing is reported as an
   exception to delete. That is what stops this table rotting into a list of things
   nobody re-checks — the failure mode that produced the bugs above. */

/* Frames that deliberately begin outside the pose: "from all fours…", "back on the
   wall…". They are the demo's approach, not its claim, so their gates are not asserted.
   Only frame 0 of a multi-frame demo can ever qualify, and never the taught pose. */
const REF_SETUP_FRAMES = {
  "plank:0":        "'From all fours…' — on hands and knees, legs not yet straight",
  "knee-plank:0":   "'From all fours…' — the body line is not made until frame 1",
  "wall-sit:0":     "'Back on the wall…' — standing, knees straight at 180°",
  "downward-dog:0": "'From all fours…' — the hips have not gone up yet",
};

/* Individual targets known to score 0 on a specific frame, for reasons that are not
   authoring mistakes and cannot be authored away.

   `gated` records whether the target was a gate WHEN THE EXCEPTION WAS WRITTEN, and is
   asserted. Without it the table rots in a direction the other two arms can't see: a
   target that is merely graded today costs nothing to excuse, but promote it to a gate
   later and this entry silently becomes a gate exemption on a demo pose — bug #40's
   exact class, arriving through the table built to prevent it. */
const REF_ZERO_TARGETS = {
  "dead-bug:1:kneeTucked": { gated:true, why:
    "UNREPRESENTABLE, permanently. A dead bug extends the OPPOSITE arm and leg; a " +
    "single-sided skeleton can only draw the same side's, which is the anti-pattern. " +
    "The frame is a drawing of a limb reaching away, not a claim about a pose." },
  "dead-bug:0:backFlat": { gated:false, why:
    "DEGENERATE GEOMETRY. backFlat reads the hip's deviation from the shoulder→knee " +
    "line; in a correct tabletop the thigh is vertical over the hip, so that line is " +
    "near-vertical and the measure stops meaning anything. Not a gate, and no cue fires " +
    "(below:'backarch' needs a NEGATIVE deviation), so nothing unsupported is said." },
};

/* Movements exempt from the folded-limb floor. Also asserted to still be JUSTIFIED:
   the exemption holds only while there is no knee gate to author a replacement against. */
const REF_FOLD_EXEMPT = {
  "hollow-tuck":
    "Still carries the FK rig's folded leg (10°/7°). It has no knee gate, so a " +
    "hand-authored replacement could only be judged on taste — redraw it when it has " +
    "a gate, or when there is a rig again.",
};

{
  const rows = [];
  const add = (label, got, want) => rows.push([label, got, want]);
  const yn  = c => c ? "yes" : "no";
  const seenSetup = new Set(), seenZero = new Set(), seenFold = new Set();

  for(const id of Object.keys(E.REF)){
    const mv = E.M[id], ref = E.REF[id];
    if(!mv){ add(`${id} — REF entry has a movement`, "missing", "present"); continue; }
    const ev   = new E.Evaluator(mv, REF_TIER);
    const last = ref.frames.length - 1;
    const frameOf = f => {
      const pose = {}; for(const k in f){ if(k === "spine") continue; pose[k] = f[k]; }
      return frameFromPose(pose);
    };

    ref.frames.forEach((f, i) => {
      const frame = frameOf(f);
      const at = `${id}[${i}]${i === last ? " (taught pose)" : ""}`;
      const setupKey = `${id}:${i}`;
      const isSetup  = setupKey in REF_SETUP_FRAMES;
      let setupStillOutside = false;

      for(const t of mv.targets){
        const v = ev.read(t, frame);
        const s = v == null ? null : E.scoreTarget(t, v, REF_TIER);
        const shown = v == null ? "null" : v.toFixed(1);
        const zeroKey = `${id}:${i}:${t.id}`;

        const zero = REF_ZERO_TARGETS[zeroKey];
        if(zero){
          seenZero.add(zeroKey);
          /* Two-way: if this ever starts scoring, the exception is the thing to delete.
             An UNREADABLE target is not the documented condition and is not accepted as
             one — a vanished joint would otherwise read as "still scores 0" forever. */
          add(`${zeroKey} — documented exception, still scores 0 (delete it if this fails)`,
              s === 0 ? "scores 0" : s == null ? `unreadable (${shown})` : `scores ${s.toFixed(0)} (${shown})`,
              "scores 0");
          /* …and still excusing the same kind of thing. */
          add(`${zeroKey} — exception still justified (gate status unchanged)`,
              (t.pos || t.gate) ? "gated" : "not gated", zero.gated ? "gated" : "not gated");
          continue;
        }
        if(!(t.pos || t.gate)) continue;   // graded targets are judged over a set, not a pose
        if(isSetup){ if(!(s > 0)) setupStillOutside = true; continue; }
        add(`${at} gate ${t.id}`, s > 0 ? "in band" : `score 0 (${shown})`, "in band");
      }

      if(isSetup){
        seenSetup.add(setupKey);
        add(`${setupKey} — setup exemption still needed (a gate still fails here)`,
            yn(setupStillOutside), "yes");
        add(`${setupKey} — setup exemption is not covering the taught pose`,
            yn(i !== last), "yes");
        /* The rule the comment above states, asserted rather than trusted. A demo's
           approach is its FIRST frame; an exemption anywhere else is excusing a pose
           the demo has already started teaching. */
        add(`${setupKey} — setup exemption is on frame 0`, yn(i === 0), "yes");
      }

      /* Folded-limb geometry, checked on every frame including setup ones: "from all
         fours" is a legitimate starting shape, a shin doubled back over its thigh is not. */
      const knee = E.readMetric(KNEE_FOLD, frame, "left");
      if(knee != null && !(id in REF_FOLD_EXEMPT))
        add(`${at} shin not folded back over the thigh`,
            knee >= REF_FOLD_FLOOR ? "clear" : `${knee.toFixed(1)}° < ${REF_FOLD_FLOOR}°`, "clear");
    });

    if(id in REF_FOLD_EXEMPT){
      seenFold.add(id);
      const folded = ref.frames.some(f => {
        const k = E.readMetric(KNEE_FOLD, frameOf(f), "left");
        return k != null && k < REF_FOLD_FLOOR;
      });
      add(`${id} — fold exemption still needed (a frame is still folded)`, yn(folded), "yes");
      /* …and still justified. The moment this movement gains a knee gate there IS
         something to author against, and the leg should be redrawn instead of excused. */
      const kneeGate = mv.targets.find(t => (t.pos || t.gate) && t.m.k === "angle" && t.m.v === "knee");
      add(`${id} — fold exemption still justified (no knee gate to author against)`,
          kneeGate ? `now gated by ${kneeGate.id}` : "no knee gate", "no knee gate");
    }

    /* A multi-frame demo must ANIMATE. Bug #39 — the side-plank demo whose `hip.y` was
       identical in all three keyframes, so the one thing a side plank IS was never shown.

       WHAT THIS CATCHES, AND WHAT IT DOES NOT. This catches a demo that is entirely
       static; nothing else in the harness does, and a frozen demo otherwise passes
       clean (measured — with its readMetric rows regenerated, the whole harness reports
       0 failed). It does NOT catch #39 as it actually shipped, where only the hip was
       frozen and every other joint moved.

       That is not laziness, it is the honest boundary, and two candidate rules were
       built and measured before settling here:
         · "the joint the movement is most about must move", focus derived from tintSegs
           — fails 15 of 21 SHIPPED demos, because the rig anchors the hip and expresses
           motion around it. A frozen hip is the normal convention, not a defect.
         · "a hold demo must arrive: its taught pose is at least as close to each ideal
           as frame 0" — catches v4.8's side-plank, but false-positives on plank,
           side-plank-knee, wall-sit, hollow-tuck and hollow-hold. Five exceptions to
           catch one bug is the exception table nobody re-reads, which is the mechanism
           (#42) this section exists to avoid.
       Distinguishing "anchor joint" from "the joint whose motion IS the exercise" needs
       authored knowledge the content model does not carry. Adding it to satisfy a test
       would be authoring content backwards from the assertion. So: assert what is true,
       and say plainly what is still only caught by looking. */
    if(ref.frames.length > 1){
      const f0 = ref.frames[0];
      const animates = Object.keys(f0).some(j =>
        ref.frames.some(f => f[j] && (f[j][0] !== f0[j][0] || f[j][1] !== f0[j][1])));
      add(`${id} demo animates (${ref.frames.length} frames)`,
          animates ? "animates" : "every frame identical — the demo is a still", "animates");
    }

    /* A rep demo that never crosses its own thresholds is not showing a rep. Mirrors
       Rep.update's arithmetic exactly: `rising` compares the raw value, otherwise the
       thresholds are OFFSETS — from frame 0 for baseline movements, from zero for the
       rest. (leg-raise-bent's downAbove was once 155, which no planted-feet pose could
       reach; the demo failing its own counter is how that was found.) */
    if(mv.reps){
      const s = mv.reps, t = mv.targets.find(x => x.id === s.driver);
      if(!t) add(`${id} — rep driver '${s.driver}' is a real target`, "missing", "present");
      else {
        const vals = ref.frames.map(f => ev.read(t, frameOf(f)));
        const base = s.baseline ? vals[0] : 0;
        const up   = s.rising ? s.upAbove   : base + s.upBelow;
        const down = s.rising ? s.downBelow : base + s.downAbove;
        const trace = vals.map(v => v == null ? "null" : v.toFixed(1)).join(" → ");
        add(`${id} rep driver ${s.driver} reaches the top (${trace})`,
            yn(vals.some(v => v != null && (s.rising ? v > up : v < up))), "yes");
        add(`${id} rep driver ${s.driver} returns to rest (${trace})`,
            yn(vals.some(v => v != null && (s.rising ? v < down : v > down))), "yes");
      }
    }
  }

  /* The other direction of the REF↔M pairing. Iterating REF catches a demo whose movement
     is gone; nothing caught a MOVEMENT WITH NO DEMO. That is not a crash — `hasDemo` hides
     the button — it is a silent capability loss: a movement ships and "Show me how" simply
     isn't offered for it, which no failing test would ever mention. */
  for(const id of Object.keys(E.M))
    add(`${id} — has a demo`, id in E.REF ? "yes" : "no demo", "yes");

  /* No stale entries: a renamed movement or a deleted frame must not leave an exception
     quietly excusing nothing. */
  for(const k of Object.keys(REF_SETUP_FRAMES))
    add(`setup exemption '${k}' refers to a real frame`, yn(seenSetup.has(k)), "yes");
  for(const k of Object.keys(REF_ZERO_TARGETS))
    add(`zero-target exception '${k}' refers to a real target`, yn(seenZero.has(k)), "yes");
  for(const k of Object.keys(REF_FOLD_EXEMPT))
    add(`fold exemption '${k}' refers to a real movement`, yn(seenFold.has(k)), "yes");

  const b = fail; section("refGates", rows.length);
  for(const [label, got, want] of rows) check("refGates", label, got, want);
  done(b);
}

/* ── 3 · filters (dt-normalised EMA) ────────────────────────────────────── */
{
  const b = fail; section("filters", V.filters.length);
  for(const r of V.filters)
    /* meta.tolerances.filter, not exact: the rows store dt rounded to 6dp but
       were computed at full precision, which moves emaAlpha by ~1e-6. */
    check("filters", `alpha=${r.alpha} dt=${r.dt}`,
          +E.emaAlpha(r.alpha, r.dt).toFixed(6), +r.out.toFixed(6), tol("filter"));
  done(b);
}

/* ── 4 · frame-rate invariance ──────────────────────────────────────────────
   NOT REPLAYABLE from vectors alone: these rows record score probes from a
   scripted scenario whose generator did not survive. The property they protect
   (identical scoring at 24/30/60/90 fps) is still enforced by `filters`, since
   emaAlpha is the mechanism. Flagged rather than silently skipped. */
console.log(`  ${"frameRate".padEnd(20)} ${String(V.frameRate.length).padStart(5)} vectors … SKIPPED (needs the lost generator)`);

/* ── 5 · tempo floor (minMs) ────────────────────────────────────────────── */
{
  const b = fail; section("tempo", V.tempo.length);
  for(const r of V.tempo){
    const spec = E.M[r.movement].reps;
    const scale = E.TIERS[r.tier].repMin ?? 1;
    const rep = new E.Rep(spec);
    const lo = spec.rising ? spec.downBelow - 8 : spec.downAbove + 8;
    const hi = spec.rising ? spec.upAbove   + 8 : spec.upBelow   - 8;
    const n = Math.round(r.cycleSecs / DT);
    let now = 0;
    for(let c = 0; c < 4; c++) for(let i = 0; i < n; i++){
      now += DT;
      const f = i / n;
      const v = f < 0.5 ? lo + (hi - lo) * (f * 2) : hi + (lo - hi) * ((f - 0.5) * 2);
      rep.update(v, now, DT, scale);
    }
    check("tempo", `${r.movement}@${r.tier} ${r.cycleSecs}s counted`, rep.reps, r.counted);
    check("tempo", `${r.movement}@${r.tier} ${r.cycleSecs}s rushed`,  rep.rushed, r.rushed);
  }
  done(b);
}

/* ── 6 · neededJoints (framing scope per movement) ──────────────────────── */
{
  const b = fail; section("neededJoints", V.neededJoints.length);
  for(const r of V.neededJoints){
    const got = [...E.neededJoints(E.M[r.movement])].sort().join(",");
    check("neededJoints", r.movement, got, [...r.need].sort().join(","));
  }
  done(b);
}

/* ── 7 · framing verdicts ───────────────────────────────────────────────── */
{
  const b = fail; section("framing", V.framing.length);
  for(const r of V.framing){
    const [x0,y0,x1,y1] = r.box;
    const at = (fx,fy) => [x0 + (x1-x0)*fx, y0 + (y1-y0)*fy];
    const f = E.framing(frameFromPose({
      ear:at(0,0), shoulder:at(.5,.1), elbow:at(.3,.35), wrist:at(0,.5),
      hip:at(.5,.5), knee:at(.7,.75), ankle:at(1,1), heel:at(.9,.9), toe:at(1,.85) }));
    check("framing", `${r.name} ok`,      f.ok,      r.ok);
    check("framing", `${r.name} verdict`, f.verdict, r.verdict);
    check("framing", `${r.name} dir`,     f.dir ?? null, r.dir ?? null);
  }
  done(b);
}

/* ── 8 · tint derivation ────────────────────────────────────────────────── */
{
  const b = fail; section("tintDerivation", V.tintDerivation.length);
  for(const r of V.tintDerivation){
    const t = E.M[r.movement].targets.find(x => x.id === r.target);
    const d = E.tintSegs(t.m);
    check("tintDerivation", `${r.movement}.${r.target} focus`, d.focus ?? null, r.focus ?? null);
    check("tintDerivation", `${r.movement}.${r.target} segs`,
          JSON.stringify(d.segs), JSON.stringify(r.segs));
  }
  done(b);
}

/* ── 9 · plan expansion ─────────────────────────────────────────────────── */
{
  const b = fail; section("planExpansion", V.planExpansion.length);
  for(const r of V.planExpansion){
    const plan = E.PLANS.find(p => p.id === r.plan);
    const got = E.expandPlanSteps(plan.steps, r.tier);
    check("planExpansion", `${r.plan}@${r.tier}`, JSON.stringify(got), JSON.stringify(r.steps));
  }
  done(b);
}

/* ── 9b · aspect correction ─────────────────────────────────────────────── */
{
  const b = fail; section("aspect", V.aspect.length);
  const dd = E.M["downward-dog"].targets.find(t => t.id === "hipAngle");
  for(const r of V.aspect){
    const f = E.REF["downward-dog"].frames[1];
    /* These rows assert aspect INVARIANCE: one physical pose must read the same
       angle in any capture orientation. MediaPipe normalises x by width and y by
       height separately, so to stand in for a capture at this aspect we divide x
       by it — which is exactly the distortion readMetric's `A` undoes. Setting
       frame.aspect on unnormalised coords instead asked the engine to correct a
       distortion nothing had applied, which is why 1.778 and 0.563 diverged while
       1.0 (a no-op both ways) passed. */
    const pose = {}; for(const k in f){ if(k === "spine") continue; pose[k] = [f[k][0] / r.aspect, f[k][1]]; }
    const frame = frameFromPose(pose); frame.aspect = r.aspect;
    check("aspect", `aspect ${r.aspect}`, +E.readMetric(dd.m, frame, "left").toFixed(2),
          +r.hipAngle.toFixed(2), 0.1);
  }
  done(b);
}

/* ── 9c · slug + rep scenarios ──────────────────────────────────────────── */
{
  const b = fail; section("slug", V.slug.length);
  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for(const r of V.slug) check("slug", r.in, slug(r.in), r.out);
  done(b);
}
{
  const b = fail; section("repScenarios", V.repScenarios.length);
  /* These rows record `finalReps`/`finalState`/`primed`/`events` — this section used
     to read sc.reps and sc.rushed, which no row has, so all three scenarios verified
     NOTHING while reporting ok. Both `undefined` guards were doing the hiding. */
  const kindOf = ev => ev.atPeak ? "atPeak" : ev.rejected ? "rejected" : ev.short ? "short" : "rep";
  for(const sc of V.repScenarios){
    const rep = new E.Rep(sc.spec);
    let now = 0;
    const events = [];
    sc.seq.forEach((v, i) => {
      now += DT;
      const ev = rep.update(v, now, DT, 1);
      if(ev) events.push({ i, kind: kindOf(ev), n: ev.n ?? null, repsAfter: rep.reps });
    });
    check("repScenarios", `${sc.name} finalReps`, rep.reps, sc.finalReps);
    check("repScenarios", `${sc.name} finalState`, rep.state, sc.finalState);
    check("repScenarios", `${sc.name} primed`, rep.primed, sc.primed);
    check("repScenarios", `${sc.name} events`, JSON.stringify(events), JSON.stringify(sc.events));
    if(sc.base != null)
      check("repScenarios", `${sc.name} base`, +rep.base.toFixed(3), sc.base, tol("value"));
    /* ACKNOWLEDGEMENT PRECEDES ACCOUNTING — the property, not just the recording. */
    sc.events.forEach((w, idx) => {
      if(w.kind !== "rep") return;
      const peak = [...sc.events.slice(0, idx)].reverse().find(e => e.kind === "atPeak");
      check("repScenarios", `${sc.name} rep ${w.n} has a preceding atPeak`, !!peak, true);
      if(!peak) return;
      check("repScenarios", `${sc.name} rep ${w.n} atPeak number`, peak.n, w.n);
      check("repScenarios", `${sc.name} rep ${w.n} atPeak precedes it`, peak.i < w.i, true);
      check("repScenarios", `${sc.name} rep ${w.n} atPeak leaves the count alone`,
            peak.repsAfter, w.repsAfter - 1);
    });
  }
  done(b);
}

/* ── 9e · rep dispatch — the double-count trap, as a vector ─────────────────
   atPeak shares one dispatch with rep/short/tooFast and needs a branch of its own
   ahead of the final else. Without one the up-crossing is routed to `rep`, and the
   shell hears "rep completed" twice per rep — at the top and again at the bottom —
   while the COUNT never moves, which is exactly why a count-only assertion misses
   it. These rows pin which slot each event lands in, frame by frame. */
{
  const b = fail; section("repDispatch", V.repDispatch.length);
  for(const row of V.repDispatch){
    const ev = new E.Evaluator(E.M[row.movement], row.tier);
    let now = 0, frame = 0;
    const got = [];
    for(const step of row.timeline){
      if(step.action === "arm"){ ev.arm(now); continue; }
      for(let i = 0; i < step.n; i++){
        now += DT;
        const f = frameFromPose(V.poses[step.pose]);
        if(step.over) Object.assign(f, step.over);
        const r = ev.evaluate(f, DT, now);
        const slot = r.atPeak ? "atPeak" : r.tooFast ? "tooFast"
                   : r.short ? "short" : r.rep ? "rep" : null;
        if(slot) got.push({ frame, slot, n: (r.atPeak ?? r.rep)?.n ?? null, reps: r.reps });
        frame++;
      }
    }
    check("repDispatch", `${row.id} events`, JSON.stringify(got), JSON.stringify(row.events));
  }
  done(b);
}

/* ── 9d · tint scenarios (severity + hysteresis + the Learning rule) ─────── */
{
  const b = fail; section("tintScenarios", V.tintScenarios.length);
  const base = V.poses.plank;
  const mild = JSON.parse(JSON.stringify(base)); mild.hip[1] += 0.045; mild.knee[1] += 0.02;
  const bad  = JSON.parse(JSON.stringify(base)); bad.hip[1]  += 0.10;  bad.knee[1]  += 0.05;
  const poses = { clean: base, mild, bad };
  for(const sc of V.tintScenarios){
    const ev = new E.Evaluator(E.M.plank, sc.tier); ev.arm(0);
    let now = 0, r = null;
    const plan = [["clean",40],["mild",60],["bad",60],["clean",90]];
    for(let i = 0; i < plan.length; i++){
      const [name, n] = plan[i];
      for(let k = 0; k < n; k++){ now += DT; r = ev.evaluate(frameFromPose(poses[name]), DT, now); }
      const want = sc.phases[i];
      const got = r.tint.segs.map(s => ({ a:s.a, b:s.b, sev:s.sev }))
                    .sort((x,y) => (x.a+x.b).localeCompare(y.a+y.b));
      check("tintScenarios", `${sc.tier}/${want.phase} segs`,
            JSON.stringify(got), JSON.stringify(want.segs));
      check("tintScenarios", `${sc.tier}/${want.phase} focus`, r.tint.focus ?? null, want.focus ?? null);
    }
  }
  done(b);
}

/* ── 10 · evaluator scenarios — the whole engine, frame by frame ────────── */
{
  const b = fail; section("evaluatorScenarios", V.evaluatorScenarios.length);
  for(const sc of V.evaluatorScenarios){
    const ev = new E.Evaluator(E.M[sc.movement], sc.tier);
    let now = 0, frame = 0;
    const seen = {}, snap = {};
    for(const step of sc.timeline){
      if(step.action === "arm"){ ev.arm(now); continue; }
      if(step.action === "check") continue;
      for(let i = 0; i < step.n; i++){
        now += DT;
        /* `over` sets frame-level fields the pose itself can't carry — sideness is
           derived from landmark z, which these 2-D synthetic poses have none of.
           Dropping it silently left the four view scenarios grading a frame whose
           viewing angle was never set, so every view assertion failed. */
        const f = frameFromPose(V.poses[step.pose]);
        if(step.over) Object.assign(f, step.over);
        const res = ev.evaluate(f, DT, now);
        seen[frame] = res;
        snap[frame] = { hold: ev.hold, guided: ev.guided ?? false };
        frame++;
      }
    }
    for(const cp of sc.checkpoints){
      const r = seen[cp.frame];
      if(!r){ check("evaluatorScenarios", `${sc.id} frame ${cp.frame}`, "no frame", "present"); continue; }
      for(const [field, want] of Object.entries(cp)){
        if(field === "frame") continue;
        /* some checkpoint fields are properties of the RESULT, others of the
           evaluator itself (hold, guided) — look in both, result first */
        let got = r[field] !== undefined ? r[field] : (snap[cp.frame] ?? {})[field];
        if(Array.isArray(want)){
          check("evaluatorScenarios", `${sc.id} f${cp.frame}.${field}`,
                JSON.stringify(got ?? []), JSON.stringify(want));
        } else if(typeof want === "number"){
          /* Per-quantity, from meta — a blanket 1.5 was applied to EVERY numeric
             checkpoint field, which meant `reps` was being compared at ±1.5: a
             counter that double-counted or dropped a rep passed silently. Counts
             are exact; only measured quantities get slack. */
          const t = field === "hold" ? tol("hold")
                  : field === "score" ? tol("score")
                  : 0;
          check("evaluatorScenarios", `${sc.id} f${cp.frame}.${field}`,
                got == null ? null : +(+got).toFixed(2), +want.toFixed(2), t);
        } else if(typeof want === "boolean"){
          check("evaluatorScenarios", `${sc.id} f${cp.frame}.${field}`, !!got, want);
        } else {
          check("evaluatorScenarios", `${sc.id} f${cp.frame}.${field}`, got ?? null, want ?? null);
        }
      }
    }
  }
  done(b);
}

/* ── content integrity (not vector-driven, but cheap and worth keeping) ──── */
{
  const b = fail; section("content integrity", 5);
  check("content", "movement count", Object.keys(E.M).length, Object.keys(C.movements).length);
  check("content", "plan count", E.PLANS.length, C.plans.length);
  check("content", "every tier has repMin",
        Object.values(E.TIERS).every(t => t.repMin != null), true);
  check("content", "every rep movement has shortCue",
        Object.values(E.M).filter(m => m.kind === "reps").every(m => m.reps.shortCue != null), true);
  /* WHICH movements no plan reaches, not how many. A count is not an assertion about
     identity: wire `hollow-hold` into a plan, let some new movement fall out of one, and
     a length check stays green through a swap it should have named. Asserted both ways —
     an orphan that gets adopted fails just as loudly as one that appears. */
  const reach = new Set(E.PLANS.flatMap(p => p.steps.filter(s => s.ex).map(s => s.ex)));
  for(const id of [...reach]) if(E.M[id]?.regression) reach.add(E.M[id].regression);
  const orphans = Object.keys(E.M).filter(id => !reach.has(id)).sort();
  const EXPECTED_ORPHANS = ["hollow-hold", "hollow-tuck"];
  check("content", "orphaned movements", orphans.join(",") || "none", EXPECTED_ORPHANS.join(","));
  done(b);
}

/* ── verdict ────────────────────────────────────────────────────────────── */
console.log(`\n  ${pass} passed · ${fail} failed`);
if(failures.size){
  const shown = [...failures.values()].reduce((a, l) => a + l.length, 0);
  console.log(`\n  ${shown} of ${fail} divergence(s), up to ${FAILS_PER_SECTION} per section:\n`);
  for(const [, list] of failures) for(const f of list) console.log("   " + f + "\n");
}
console.log(fail === 0
  ? "\n✅ the build matches every recorded vector\n"
  : "\n❌ divergence — fix the BUILD, never the vectors (see the anti-divergence rule)\n");
process.exit(fail === 0 ? 0 : 1);
