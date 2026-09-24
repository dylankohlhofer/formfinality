# FormFinder exercise-demo production prototype

An isolated Remotion project: a silent, 16.2-second, three-cycle bodyweight-squat
study in landscape (1920×1080) and portrait (1080×1920), both at 30 fps.
The current figure is the user's **Alien Soldier** character from Mixamo,
converted locally from `Ch44_nonPBR.fbx`. The previous procedural figure remains
in source for comparison; it is not a silent fallback if the imported model fails.
The movement is authored, not motion-captured or approved exercise instruction.
The permanent prototype label is intentional.
This does **not** replace the live app's demos, change its engine, or add React
or a cloud service to the app. No private recordings or model files were uploaded.
The user-supplied third-party character is processed only on this machine.

## Run locally

Use Node 24 or newer (the tests use Node's built-in TypeScript stripping).
Install the root's existing dev dependencies first (`npm ci` at the repo root)
for the preparation script's Playwright browser. From this directory:

```sh
npm ci
npm run prepare:character
npm run check
npm run dev
```

Studio prints its address, normally `http://localhost:3123/SquatLandscape`.
Choose `SquatPortrait` in the sidebar to review the phone-format composition.
Remotion Studio also advertises a LAN address: run it only on a trusted network,
do not expose it publicly, and stop the dev process when finished. It contains
only this isolated prototype, not workout recordings. All composition assets,
fonts and geometry load locally; no runtime model API or TTS is used.

`prepare:character` expects the user's FBX at the repo root, or accepts an explicit
path after `--`. It preserves that original and refuses to overwrite an existing
`public/models/alien-soldier.glb`. Source and derived character binaries are
git-ignored: a fresh checkout must obtain the licensed model and run preparation.
Missing assets fail tests/rendering visibly, never count as passed coverage.
No raw character redistribution or public hosting has been performed.

The creation pass opens Studio and renders QA stills only. An MP4 export is an
explicit next action, not a file that has already been delivered:

```sh
npx remotion render SquatLandscape out/squat-landscape.mp4
npx remotion render SquatPortrait out/squat-portrait.mp4
```

Do not overwrite an earlier approved export. Keep the sources, lockfile and
review decision together. Generated `out/` files and `node_modules/` are ignored.
Default Chromium setup may need an initial download. With a compatible installed
Chrome **headless shell**, a local visual check can use:

```sh
npx remotion still SquatLandscape out/review-090.png --frame=90 --scale=0.5 --browser-executable=/absolute/path/to/headless_shell
npm run check:render -- /absolute/path/to/headless_shell
npm run check:studio  # with Studio running on port 3123
```

## What the tests prove

- Thirty tests cover invalid frames, deterministic scrubbing, closed loops, finite
  geometry, fixed feet, constant limb lengths, bounded frame changes, full-figure
  and platform framing (including extended hands) in both formats, teaching-card
  persistence, the revised pace and lowered shoulder placement. The hand checks
  reject degenerate inputs, preserve forearm alignment without abrupt twisting,
  and require palms to face down at the bottom pose. Camera checks keep the second
  full squat front-on, turn only while standing and preserve deterministic seeks.
- Eleven imported-asset tests additionally cover the real skeleton, texture embedding
  and size, normalized skinning weights, two material groups, missing/invalid
  inputs, seek order, foot/toe contact, fixed bone lengths, the actual deformed
  mesh's bounds/floor and side-projection rep compatibility at both supported tiers.
  The stage-transform regression protects playback after the first mounted frame;
  an isolated first still would not catch this coordinate-space error.
  The front-view follow-up also protects outward knee travel, bottom alignment
  with each foot's direction and smooth paths. Mesh framing covers all 486 frames,
  including both viewing angles and their transitions.
- The existing `testing/lib.mjs` loads the unchanged HTML engine. An explicitly
  synthetic, isotropic **side projection** of the rig completes exactly three reps
  at Building and Strong tiers; stationary standing and bottom poses earn none.
- This is not inference on rendered pixels, not the oblique presentation camera,
  not proof of correct biomechanics or recognition on real bodies. No scores are
  displayed. No original conformance vectors were changed or generated from it.
- These prototype checks run with `npm run check` **here**, not in the root's
  existing `npm test` or GitHub workflow. Integration can follow the pilot review;
  do not report these as CI-covered until that happens.
- `check:render` separately makes six cold-load stills: standing, bottom and the
  final frame in both formats. Pixel checks require visible character pixels away
  from the floor/text, so a successfully exported empty stage fails. This is not
  a frame-rate benchmark, real-device check or technique validation.

`motion.ts` defines the motion; `proportions.ts` shares the illustrative proportions;
`HumanDetails.tsx` retains the original procedural figure; `AlienSoldier.tsx` and
`mixamo-rig.ts` load/pose the imported character in `Figure.tsx`; `SquatDemo.tsx` provides
the instructional composition. All animation comes from Remotion's frame index,
not CSS animation, wall-clock timers, or Three.js `useFrame()`.
Iris marks demonstration progress only. The current suit and scene are monochrome.
Natural skin/hair are an explicitly illustrative material lane, never severity,
progress or live measurement colours. No mint/amber/red assessment tint is used.
At the user's request, each teaching card persists for one complete rep with a
short fade, rather than changing at the half-second bottom pause. The follow-up
pace adjustment shortens each rep from 6 to 5.4 seconds: 1.8 seconds down, a
half-second bottom pause, 1.8 seconds up and 1.3 seconds standing across the loop.
Three cards give a 16.2-second composition. The earlier procedural refinement
lowered shoulders and reduced feet/hips; those are not constraints imposed on the
imported model. It retains its own bone lengths and uses two-bone leg IK to keep
the original feet fixed while following the authored squat/arm phase pattern.
Exact joint trajectories therefore differ with the character's proportions.
This is presentation geometry, not a change to exercise assessment.

The second repetition now shows the front view to teach knee spacing. The camera
orbits during the standing gaps, settles before lowering and returns to the
three-quarter view for the third repetition; the 16.2-second duration is unchanged.
The full-rep card teaches knees following the toes, not a centimetre gap or one
stance for every body. The first card offers slightly wider than hip-width as a
starting point. This paraphrases the foot/knee relationship in the ACE reference
below; it is not endorsement of this rig or its exact trajectory.

Front inspection exposed inward knee travel in the original forward-only leg IK.
The revised solver retains the model's neutral stance, original foot position and
direction, and constant limb lengths. During bending it brings the knee into its
own toe-direction plane using an explicitly authored transition. This is a demo
correction, not a new assessment gate or a body-independent anatomical rule.
The page adds only a small monochrome viewing-angle label, not another panel,
width ruler or live-form colour. In portrait it sits above the stage so it cannot
overlap the instruction card. The user approved the new visual direction.

## Approved presentation; character remains a prototype

The user explicitly wants to retain this demo-page design: dark canvas, type,
instruction cards, stage and iris progress line, in both formats. Do not redesign
`SquatDemo.tsx` as part of replacing the character. This is approval of the visual
direction, not approval of exercise technique or integration into the live app.

The previous procedural refinement reduced the nose and ears, removed the dark ear
insets, cropped the hair closer to the skull and replaced the camera-facing hand
roll with forearm-aligned hands (palms down when raised). The user subsequently
provided Alien Soldier. Page markup, instructional cards and 5.4-second timing
remain unchanged during its import. Horizontal fill light reveals its dark suit.

The imported character establishes the local rigged-mesh workflow. A production
character still needs a decision on style and instructional readability.
[Remotion's Three.js integration](https://www.remotion.dev/docs/three) lets us keep
the composition around a different character. [Blender's animation/rigging tools](https://www.blender.org/features/animation/)
are a candidate for asset preparation, not a replacement page renderer. Asset
licensing, deformation, joint mapping and full-cycle technique review are required
before release; the current model is a user-selected preview asset, not final approval.
Finished demo assets could be bundled for on-device playback without a runtime
generation service. This is a proposed production route, not shipped playback.

A plugin-directory check on 23 September found no Blender plugin. Runway and
Higgsfield were discoverable but not installed; they generate media rather than
providing a drop-in editable human rig. No new plugin or external account was
connected, and no private media was uploaded. Product Design remains useful for
the future player/controls, not for correcting anatomy. Generative-video polish
would still require independent motion review and is not the recommended next
step for these exercise instructions.

## Content provenance and review gate

User-supplied asset: **Alien Soldier**, `Ch44_nonPBR.fbx`, identified by the user as
a [Mixamo character](https://www.mixamo.com/). Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
permits commercial use in projects. This is not a public-domain designation or
permission to redistribute the standalone source model. See
[`assets/alien-soldier.md`](assets/alien-soldier.md) for hashes, conversion choices
and explicit limitations. The original source is unchanged.

Background reference, accessed 23 September 2026:
[ACE Bodyweight Squat](https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/).
The general movement concepts informed the draft; no source photographs, video,
likeness or narration were copied. The exact joint trajectories and simplified
figure were authored for this prototype, not extracted or certified by ACE.

Before any in-app release: obtain a qualified technique review of the full cycle
from useful views, check joint alignment and contact, beginner comprehension,
appropriate variants and accessible pause/replay controls, then verify actual
phone playback and asset budgets. Caption and shape review does not establish
that this is appropriate for every body. Squat is supported only at Building and
Strong in the current app; this is not a new Learning-tier exercise. Plank and
Leg Raise are proposed follow-ups, not implemented compositions.

## Plugins installed for this work

Local configuration confirms **Remotion**, **Product Design** and **GitHub**.
These are not OpenArt/Runway accounts; no paid generation provider was connected.

| Plugin | Useful next application | Boundary |
| --- | --- | --- |
| Remotion | Repeatable demo production, frame-level QA, landscape/portrait exports, later promotional videos | Rendering does not establish correct form; review remains mandatory |
| Product Design | Screenshot-first review of demo entry, pause/replay, mobile framing and interruption; explore clearer demo-player layouts before coding | No new UI audit or redesign was performed in this pass; preserve assessment, consent, colour and accessibility rules |
| GitHub | Inspect failing Actions runs, connect retained failures to issues/PRs, review source/lockfile changes and later add a scoped demo check | Installation does not prove repository authentication or workflow-write permission; no remote writes, workflow edits, commits or pushes were made |

Recommended order: investigate the retained audio failures and verify existing CI
access with GitHub → review this motion study → use Product Design for the in-app
player experience → add only the approved production/test workflow.

## Verification record — 23 September 2026

The thirty prototype tests and TypeScript/ESLint checks pass after the front-view
follow-up. Ten cold-load render checks pass in
`out/asset-render-check-StNsMd/report.json`, covering both angles at standing and
bottom positions plus the final frame in both formats. A stage-only pixel hash
check rejects changing just the caption while retaining the same camera. Stills
were visually reviewed; the portrait angle label was moved above the stage to
avoid the teaching-card heading. The first new knee test exposed its own setup
error (the right-side standing assertion inherited the left-side bottom pose);
resetting to frame zero between sides fixed the test without changing assertions.

The final live Studio smoke passes in `out/studio-check-L8yU2p/report.json`: all
three reps, both views and their transitions, restart/frame stepping, no page
errors, and a real-layout assertion that the portrait angle label is above the
teaching card. Screenshots of both Studio layouts are retained beside the report.

The earlier import-only checkpoint passed 25 tests, six cold-load renders
(`out/asset-render-check-YfS45O/`) and the Studio playback/restart/frame-step smoke
(`out/studio-check-asYlvF/`). These checks are local desktop functional evidence,
not real-time frame-rate or mobile-performance claims.
The first portrait test caught insufficient framing; visual review also caught
an oversized floor platform. Both were corrected without weakening the checks.
The import pass caught and repaired blank asynchronous-load stills and a
post-mount stage-coordinate error. An initial full-mesh test was deliberately
stopped after 263 seconds: the unoptimised FBX export created 326 material
primitives. Regrouping the same triangles into two opaque materials brought the
complete 25-test check to approximately 3 seconds on this machine. No tests or
geometric invariants were weakened; this is not a phone-performance claim.

Root `npm test` was run and **exited 1**. Evidence:
`../test-results/2026-09-23T18-39-12-622Z-44411/index.html`.
82 infrastructure tests, 25 regression suites, all four original harnesses,
55 engine cases, 110 browser cases and 151 shell cases passed. **Nine of 16 audio
cases failed**, with recorded-clip loading stalls or missing audible output;
12 video cases remain blocked. The nine are `ask-repeat-resume`,
`pause-cancels-correction`, `skip-during-teaching`, `tracking-loss`,
`clips-steady-learning`, `queue-expiry`, `clips-warm-learning`,
`clips-energy-learning` and `clips-energy-building`.

The saved and current HTML SHA-256 both equal
`d15aa0bb63863b082dd47bd7b0257548776bc3ca5bd11fab44db46bb46071aa1`.
No app/audio/test-oracle source changed. Rendering/Studio work overlapped parts
of the run; resource contention is an unconfirmed possibility, not a diagnosis
or a reason to dismiss failures. No passing full-suite claim is made.

## Licensing

Remotion is source-available under its own licence, not simply MIT. Its current
[licence FAQ](https://www.remotion.dev/docs/license/faq) allows eligible individuals
and teams up to three people to use it commercially for free; verify headcount,
contractor aggregation and terms before production. No licence purchase was made.
External models, motion clips, fonts or voice assets need separate rights checks.
The current external creative-asset dependency is the user's Mixamo character;
its binaries stay local and are excluded from version control.
