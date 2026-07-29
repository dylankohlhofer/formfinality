#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Form Coach — verify-mutations.mjs

   Mutation-tests the `refGates` section of verify.mjs. Breaks a demo keyframe on
   purpose, runs the real harness against the broken build, and asserts it fails —
   by name, on the check that should have caught it.

   WHY THIS EXISTS: `refGates` exists because `gen-refs.mjs` made the same assertion
   and was lost, leaving three documents crediting coverage nothing executed. Bugs
   #40 and #41 walked through that gap. An assertion nobody has watched fail is an
   assumption, and a suite that silently stops biting is exactly the failure mode
   `refGates` was written to end — so it gets a test of its own, in the repo, where
   the last one wasn't.

   The mutations were derived once, from the real bugs. They are kept here so they
   can be RE-RUN rather than re-derived from prose.

   NOT EVERY refGates ASSERTION CAN BE MUTATED HERE, and the gap is named rather than
   papered over: mutations edit the BUILD, so a rule about the shape of the exception
   tables in verify.mjs — "a setup exemption must sit on frame 0" — has no build edit
   that trips it. Prepending a frame to a setup demo just renumbers what `plank:0`
   points at, and the rule still holds. It is a guard on the harness, watched by
   reading it, and that is the whole of its coverage.

   USAGE
     node verify-mutations.mjs path/to/build.html    # the build is REQUIRED

   The build is never defaulted, for the same reason verify.mjs doesn't default it:
   grading one build's mutations against another is a green run that proves nothing.

   Nothing in the repo is modified. Each mutation is written to a temporary copy
   alongside the build and deleted afterwards, including on failure.

   EXIT 0 = every mutation was caught, and the unmodified control stayed green.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { dirname, resolve, join } from "path";

const BUILD = process.argv[2];
if(!BUILD){ console.error("usage: node verify-mutations.mjs <build.html>"); process.exit(2); }
if(!existsSync(BUILD)){ console.error(`no such build: ${BUILD}`); process.exit(2); }
const ROOT = dirname(resolve(BUILD));

const load = () => readFileSync(BUILD, "utf8");

/* Replace one movement's `frames` array in the build text. Deliberately the same
   surgical edit a person makes by hand — labels, fps and the — escapes are
   left alone, so the mutation is only ever the coordinates.

   Only the frames ARRAY is replaced, located by scanning to its matching bracket, so
   every other key survives byte for byte whatever order they appear in. This used to
   rebuild the line from its prefix and drop anything that followed `frames`; `frames`
   happens to be last in all 21 entries today, so it silently worked — but a `props`
   authored after it would have been deleted by the mutation and the suite would have
   reported a catch it hadn't really made. */
function withFrames(html, id, frames){
  const i = html.indexOf(`  "${id}": {`);
  if(i < 0) throw new Error(`REF entry ${id} not found in ${BUILD}`);
  const eol = html.indexOf("\n", i);
  const f   = html.indexOf('"frames":', i);
  if(f < 0 || f > eol) throw new Error(`no frames key in ${id}`);
  const open = html.indexOf("[", f);
  if(open < 0 || open > eol) throw new Error(`frames is not an array in ${id}`);
  let depth = 0, end = -1;
  for(let k = open; k < eol; k++){
    if(html[k] === "[") depth++;
    else if(html[k] === "]" && --depth === 0){ end = k + 1; break; }
  }
  if(end < 0) throw new Error(`unterminated frames array in ${id}`);
  return html.slice(0, open) + JSON.stringify(frames) + html.slice(end);
}
/* Read a movement's current REF entry out of the build, so mutations are expressed
   as edits to what is actually shipped rather than to a stale copy pasted in here. */
function refOf(id){
  const html = load();
  const i = html.indexOf(`  "${id}": {`);
  if(i < 0) throw new Error(`REF entry ${id} not found in ${BUILD}`);
  const eol = html.indexOf("\n", i);
  return JSON.parse(`{${html.slice(i, eol).replace(/,$/, "").trim()}}`)[id];
}

/* The pre-fix `glute-bridge` frame 0, verbatim — the pose that shipped, and what
   bug #41 actually was: knee folded to 9.9°, shin lying back along the thigh, so
   drawRef painted the two capsules as one bar and `kneesBent` (ideal 100°) scored 0.
   Frozen here on purpose. If refGates ever stops failing on THIS, it is broken. */
const FOLDED_GLUTE_BRIDGE_F0 = {
  hip:[0.591,0.41], shoulder:[0.254,0.41], ear:[0.153,0.41],
  elbow:[0.444,0.427], wrist:[0.623,0.442], knee:[0.752,0.18],
  ankle:[0.638,0.424], heel:[0.583,0.434], toe:[0.647,0.342]
};

const MUTATIONS = [
  { name: "glute-bridge f0 folded back to 9.9° — bug #41's pose, verbatim",
    why:  "the gate AND the geometry floor must both catch it",
    apply: h => withFrames(h, "glute-bridge", [FOLDED_GLUTE_BRIDGE_F0, refOf("glute-bridge").frames[1]]),
    expect: ["glute-bridge[0] gate kneesBent",
             "glute-bridge[0] shin not folded back over the thigh"] },

  { name: "glute-bridge f1 folded — the fold moved onto the TAUGHT pose",
    why:  "the final frame is the pose the demo is teaching; it is not a weaker check",
    apply: h => withFrames(h, "glute-bridge", [refOf("glute-bridge").frames[0], FOLDED_GLUTE_BRIDGE_F0]),
    expect: ["glute-bridge[1] (taught pose) gate kneesBent"] },

  { name: "leg-raise-bent f1 hip barely flexed — gates still pass, driver does not",
    why:  "a demo can be a legal pose and still fail to demonstrate a rep",
    apply: h => { const fr = refOf("leg-raise-bent").frames.map(f => ({...f}));
                  fr[1] = {...fr[1], knee:[0.615,0.478], ankle:[0.719,0.324]};
                  return withFrames(h, "leg-raise-bent", fr); },
    expect: ["rep driver hipAngle reaches the top"] },

  { name: "dead-bug f1 'fixed' so its documented exception no longer applies",
    why:  "EXCEPTION ROT, the direction people forget: an exception that starts " +
          "passing must report itself as one to delete",
    apply: h => { const fr = refOf("dead-bug").frames.map(f => ({...f}));
                  fr[1] = {...fr[1], knee:[0.725,0.712], ankle:[0.760,0.560]};
                  return withFrames(h, "dead-bug", fr); },
    expect: ["dead-bug:1:kneeTucked — documented exception"] },

  { name: "plank reduced to its setup frame — exemption now covers the taught pose",
    why:  "a setup exemption must never end up excusing the pose being taught",
    apply: h => withFrames(h, "plank", [refOf("plank").frames[0]]),
    expect: ["plank:0 — setup exemption is not covering the taught pose"] },

  { name: "hollow-tuck renamed — its fold exemption now excuses nothing",
    why:  "a stale exception key must not sit there quietly excusing a movement " +
          "that no longer exists, AND the movement it left behind now has no demo",
    apply: h => h.replace('  "hollow-tuck": {', '  "hollow-tuck-renamed": {'),
    expect: ["fold exemption 'hollow-tuck' refers to a real movement",
             "hollow-tuck — has a demo"] },

  { name: "dead-bug backFlat promoted to a gate — its zero-exception was written for a graded target",
    why:  "EXCEPTION ROT in the direction the other arms cannot see. Excusing a score of 0 " +
          "on a target nothing gates costs nothing; the same entry on a GATE is a demo pose " +
          "the app would refuse, which is bug #40 arriving through the table built to stop it",
    apply: h => h.replace('below:"backarch"}', 'below:"backarch", gate:true}'),
    expect: ["dead-bug:0:backFlat — exception still justified"] },

  { name: "side-plank frozen to one repeated pose — a demo that is a still",
    why:  "bug #39's class. NOTE this is the total freeze, not #39 as it shipped " +
          "(where only the hip was frozen) — see the boundary note in refGates",
    apply: h => { const held = refOf("side-plank").frames[1];
                  return withFrames(h, "side-plank", [held, held, held]); },
    expect: ["side-plank demo animates"] },

  { name: "control — unmodified build",
    why:  "a suite that fails on everything catches nothing",
    apply: h => h,
    expect: [] },
];

/* ── run ─────────────────────────────────────────────────────────────────── */
console.log(`\nForm Coach — refGates mutation test`);
console.log(`build   ${BUILD}\n`);

let missed = 0;
for(const m of MUTATIONS){
  const tmp = join(ROOT, `.mutant-${process.pid}.html`);
  let out = "", broke = null;
  try {
    writeFileSync(tmp, m.apply(load()));
    /* Non-zero exit is the expected outcome for a mutation, so the throw carries
       the output we actually want to read. */
    try { out = execFileSync("node", ["verify.mjs", tmp], { cwd: ROOT, encoding: "utf8" }); }
    catch(e){ out = (e.stdout || "") + (e.stderr || ""); }
  } catch(e) {
    /* The mutation itself could not be applied — a renamed movement, a changed REF
       shape. That is a broken TEST, not a passing build, and it must say so by name
       rather than by stack trace. */
    broke = e.message;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }

  if(broke){
    missed++;
    console.log(`  ✗ ${m.name}`);
    console.log(`      ${m.why}`);
    console.log(`      could not apply this mutation: ${broke}`);
    console.log(`      the mutation is stale, not the build — fix it here\n`);
    continue;
  }

  const line   = (out.split("\n").find(l => l.includes("refGates")) || "").trim();
  const failed = /refGates\s+\d+ vectors … \d+ FAILED/.test(line);
  const caught = m.expect.filter(e => out.includes(e));
  const ok     = m.expect.length ? (failed && caught.length === m.expect.length) : !failed;

  console.log(`${ok ? "  ✓" : "  ✗"} ${m.name}`);
  console.log(`      ${m.why}`);
  console.log(`      ${line || "(no refGates line — did the harness run?)"}`);
  for(const e of m.expect)
    console.log(`      ${out.includes(e) ? "caught  " : "MISSED  "} ${e}`);

  if(!ok){
    missed++;
    const detail = out.split("\n").filter(l => l.includes("refGates ·")).slice(0, 6);
    if(detail.length) console.log(detail.map(l => "        " + l.trim()).join("\n"));
  }
  console.log();
}

console.log(missed
  ? `❌ ${missed} mutation(s) NOT caught — refGates has stopped biting\n`
  : `✅ all ${MUTATIONS.length - 1} mutations caught, control stayed green\n`);
process.exit(missed ? 1 : 0);
