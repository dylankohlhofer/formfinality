#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Form Coach — verify-draw.mjs

   The first automated coverage `drawRef` has ever had.

   WHY THIS EXISTS: `refGates` proves a demo's NUMBERS pass the movement's own gates.
   It cannot see the picture. For as long as it has existed, `drawRef` mapped the
   reference's coordinates with `x*W, y*H` — and REF is authored ISOTROPICALLY, so
   every demo was stretched by the canvas aspect: 1.41x in the 480x340 demo box,
   1.78x in the 1280x720 ghost overlay. Nothing failed. The demos passed every gate
   they were judged on while being drawn as a different shape.

   There is no canvas in node, so this records the 2D operations `drawRef` issues and
   asserts on their geometry. Two properties, both derived — there is nothing recorded
   to drift from:

     1 · ISOTROPY. `drawRef` sets the head radius to `scale * .21`, where `scale` is the
         drawn shoulder→hip length. Divide the drawn radius by the AUTHORED torso length
         and the canvas scale and the answer is .21 exactly, for every demo and every
         frame, if and only if the mapping is isotropic. Under the old mapping it ranged
         .21 to .296 — an identical rig drew a head 1.41x larger in a lying demo than an
         upright one.

     2 · THE GHOST SUPERIMPOSES. The ghost is drawn by `drawRef`; the live skeleton
         beside it is drawn from raw MediaPipe landmarks as `(x*canvas.width,
         y*canvas.height)`. For a correct pose to line up with the shape it is being
         asked to copy, the two must differ by a SIMILARITY — one uniform scale plus a
         translation. A non-uniform stretch cannot be lined up however the person stands,
         and that is what shipped: the best-fit scale ranged 1.26 to 2.20 across demos,
         residuals up to 76px.

   USAGE
     node verify-draw.mjs path/to/build.html   # the build is REQUIRED, never defaulted

   EXIT CODE 0 = every demo is drawn in the proportions it was authored in.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { pathToFileURL } from "url";

const BUILD = process.argv[2];
if(!BUILD){ console.error("usage: node verify-draw.mjs <build.html>"); process.exit(2); }

/* ── load REF + drawRef out of the single-file build ─────────────────────── */
const html = readFileSync(BUILD, "utf8");
const js = html.split('<script type="module">')[1]?.split("</script>")[0];
if(!js) throw new Error(`no module script found in ${BUILD}`);
const start = js.indexOf("const TIERS"), end = js.indexOf("const VERSION");
if(start < 0 || end < 0 || end <= start)
  throw new Error("engine boundaries not found — has the build structure changed?");
const tmp = `./.draw-${process.pid}.mjs`;
writeFileSync(tmp, js.slice(start, end) + `\nexport { REF, drawRef };`);
let D;
try { D = await import(pathToFileURL(tmp).href); }
finally { try { unlinkSync(tmp); } catch {} }

/* ── just enough CanvasRenderingContext2D to record what drawRef draws ───── */
class Rec {
  constructor(){ this.strokes = []; this.arcs = []; this.path = []; this.cur = null;
                 this.lineWidth = 1; this.strokeStyle = ""; this.fillStyle = "";
                 this.lineCap = ""; this.lineJoin = ""; }
  save(){} restore(){}
  beginPath(){ this.path = []; this.cur = null; }
  moveTo(x, y){ this.cur = [[x, y]]; this.path.push(this.cur); }
  lineTo(x, y){ this.cur ? this.cur.push([x, y]) : this.moveTo(x, y); }
  quadraticCurveTo(cx, cy, x, y){ this.cur && this.cur.push([x, y]); }
  arc(x, y, r){ this.arcs.push({ x, y, r }); }
  stroke(){ for(const sp of this.path) this.strokes.push(sp); }
  fill(){}
}
const draw = (pose, W, H, ghost) => { const r = new Rec(); D.drawRef(r, pose, W, H, ghost); return r; };

let pass = 0, fail = 0;
const fails = [];
const check = (label, got, want) => {
  if(got === want){ pass++; return; }
  fail++; fails.push(`${label}\n      expected ${want}\n      got      ${got}`);
};

console.log(`\nForm Coach — reference drawing verification`);
console.log(`build   ${BUILD}\n`);

/* ── 1 · isotropy ────────────────────────────────────────────────────────── */
const HEAD_K = 0.21;                       // drawRef: head radius = scale * .21
const isoTorso = f => Math.hypot(f.hip[0] - f.shoulder[0], f.hip[1] - f.shoulder[1]);
{
  const before = fail;
  let n = 0, lo = Infinity, hi = -Infinity;
  /* Deliberately BOTH shapes of canvas, and a square: a bug that cancels at one
     aspect must not hide. The square is the control — every mapping agrees there. */
  for(const [W, H] of [[480, 340], [1280, 720], [720, 1280], [400, 400]]){
    const S = Math.min(W, H);
    for(const id of Object.keys(D.REF)) D.REF[id].frames.forEach((f, i) => {
      if(!f.hip || !f.shoulder) return;
      const r = draw(f, W, H, false).arcs.pop();
      if(!r) return;
      const k = r.r / (isoTorso(f) * S);
      lo = Math.min(lo, k); hi = Math.max(hi, k); n++;
      check(`${id}[${i}] @${W}x${H} drawn in authored proportions`,
            +k.toFixed(4), HEAD_K);
    });
  }
  process.stdout.write(`  ${"isotropy".padEnd(20)} ${String(n).padStart(5)} frames  … `);
  console.log(fail === before
    ? `ok (head/torso ${lo.toFixed(4)}–${hi.toFixed(4)}, ideal ${HEAD_K})`
    : `${fail - before} FAILED (head/torso ${lo.toFixed(4)}–${hi.toFixed(4)}, ideal ${HEAD_K})`);
}

/* ── 2 · the ghost superimposes ──────────────────────────────────────────── */
{
  const before = fail;
  const [W, H] = [1280, 720];              // what openCamera asks for
  const A = W / H;
  /* drawRef strokes the torso first, then the limbs in a fixed order, one moveTo/lineTo
     per limb — so the joint pixel coordinates come straight back out of the ops. */
  const PAIRS = [["shoulder","hip"], ["shoulder","elbow"], ["elbow","wrist"],
                 ["hip","knee"], ["knee","ankle"], ["ankle","heel"], ["heel","toe"]];
  let worstRms = 0, worstK = null;
  for(const id of Object.keys(D.REF)){
    const pose = D.REF[id].frames[D.REF[id].frames.length - 1];
    const strokes = draw(pose, W, H, true).strokes;     // ghost:true skips the ground line
    const g = {};
    strokes.forEach((s, i) => {
      if(!PAIRS[i]) return;
      g[PAIRS[i][0]] = s[0]; g[PAIRS[i][1]] = s[s.length - 1];
    });
    const names = Object.keys(g).filter(j => pose[j]);

    /* The same physical pose, captured: placed at 0.8 scale in a frame A wide and 1
       tall, then normalised by the camera the way MediaPipe does — and drawn the way
       loopBody draws the live skeleton. */
    const s = 0.8, dx = 0.15, dy = 0.10;
    const live  = names.map(j => [((s*pose[j][0] + dx)/A)*W, (s*pose[j][1] + dy)*H]);
    const ghost = names.map(j => g[j]);

    /* Best uniform scale k and translation t mapping live → ghost, least squares. */
    const n = names.length;
    const m = p => [p.reduce((a,v)=>a+v[0],0)/n, p.reduce((a,v)=>a+v[1],0)/n];
    const mp = m(live), mq = m(ghost);
    let num = 0, den = 0;
    for(let i = 0; i < n; i++){
      const ax = live[i][0]-mp[0], ay = live[i][1]-mp[1];
      num += ax*(ghost[i][0]-mq[0]) + ay*(ghost[i][1]-mq[1]);
      den += ax*ax + ay*ay;
    }
    const k = num/den, t = [mq[0] - k*mp[0], mq[1] - k*mp[1]];
    let se = 0;
    for(let i = 0; i < n; i++)
      se += (k*live[i][0]+t[0]-ghost[i][0])**2 + (k*live[i][1]+t[1]-ghost[i][1])**2;
    const rms = Math.sqrt(se/n);
    if(rms > worstRms){ worstRms = rms; worstK = k; }
    check(`${id} ghost superimposes on a correct pose (residual ${rms.toFixed(2)}px)`,
          rms < 0.01, true);
    /* The recovered scale must be the inverse of the placement — not merely SOME
       uniform scale, but the right one. */
    check(`${id} ghost scale matches the placement`, +k.toFixed(3), +(1/s).toFixed(3));
  }
  process.stdout.write(`  ${"ghostSuperimpose".padEnd(20)} ${String(Object.keys(D.REF).length).padStart(5)} demos   … `);
  console.log(fail === before ? "ok (residual 0.00px, uniform scale throughout)"
    : `${fail - before} FAILED (worst residual ${worstRms.toFixed(2)}px, k=${worstK?.toFixed(3)})`);
}

console.log(`\n  ${pass} passed · ${fail} failed`);
if(fails.length){
  console.log(`\n  ${Math.min(fails.length, 10)} of ${fail} failure(s):\n`);
  for(const f of fails.slice(0, 10)) console.log("   " + f + "\n");
}
console.log(fail === 0
  ? "\n✅ every demo is drawn in the proportions it was authored in\n"
  : "\n❌ the drawing does not match the authoring — fix drawRef, not the keyframes\n");
process.exit(fail === 0 ? 0 : 1);
