# Alien Soldier — local asset record

Provided by the user on 23 September 2026 as `Ch44_nonPBR.fbx`, from
[Mixamo](https://www.mixamo.com/#/?page=1&type=Character), named **Alien Soldier**.
No third-party purchase, new account connection or upload was performed here.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Original FBX (retained at repo root) | 98,272,560 | `83371ebe5d839d07190b8f4a07c6dabbffb6ceef9274e5f62b6566bc739d7211` |
| Local prepared GLB | 9,258,336 | `cb1273b987e493147eb0148df4d0cdfa80ec4352ebfb9b06379adcf3cf8db9e9` |

The original and prepared binaries are git-ignored. Do not automatically upload
them, publish the development server, or treat these as freely redistributable
source assets. Check Adobe's applicable terms for the intended distribution;
its [FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) expressly lists
commercial project uses. Keep this record with any future rendered demo export.

## Conversion

`scripts/prepare-mixamo.mjs` serves only the supplied FBX and required Three.js
modules on loopback, using the existing local Playwright browser. It blocks
external requests. The script never alters the FBX and refuses to overwrite the
prepared GLB. The import record is written to `out/alien-soldier-import.json`.

- 65 Mixamo bones, including fingers. The supplied tracks are a one-frame pose,
  not a squat clip. They are not presented as captured exercise motion.
- 46,108 triangles retained, 27,038 deduplicated vertices, no decimation.
- 326 interleaved material groups regrouped into two opaque material primitives.
- Four embedded diffuse/normal textures reduced from 4096² to 1024².
- Non-PBR materials converted to a matte PBR approximation (roughness 0.75,
  metalness 0). Gloss/specular fidelity is not claimed. The loader explicitly
  warned that its `ShininessExponent` map is unsupported.
- The loader also warned about vertices with more than four skinning influences.
  Its four retained influences are normalized; this conversion can affect
  deformation and remains a visual-review limitation, not lossless import.

## Movement and verification

The existing 5.4-second timing, three full-rep teaching cards and stage layout
are retained. The second rep now faces forward; camera turns occur only while
standing. Its card explains knees following the toe direction, not a fixed gap.
Character-native bone lengths are preserved. Foot-locked leg IK and
the authored torso/arm phase angles drive deterministic poses; playback resets
from the bind pose at every frame. Asset-local calculations prevent the mounted
stage's scale/rotation from being applied twice. No Mixamo exercise animation or
generated motion was substituted for the reviewed phase pattern.

Front inspection exposed inward knee travel in the original forward-only IK.
The corrected solver preserves neutral standing alignment and gradually aligns
each bent knee with that foot's direction. Fixed foot position/orientation and
limb lengths remain protected. This authored path is specific to this character,
not a universal body rule or a new app assessment threshold. The GLB and original
FBX are unchanged; only runtime prototype posing and presentation were revised.

30 prototype tests pass, including eleven imported-asset tests. They cover actual
skinned-mesh framing and floor clearance, fixed feet/toes, stable bone lengths,
random seeking, knee travel/alignment and stage-parent transforms. Both layouts'
mesh bounds are checked at every frame, including camera transitions. Synthetic side projections of the
actual bones count three reps in Building/Strong; static poses count none.
These are not MediaPipe inference on rendered pixels or biomechanical validation.

Ten cold-load PNG checks in `out/asset-render-check-StNsMd/` assert the character is
present and the front view differs from the same pose at the original angle,
with visual standing/bottom review in both layouts. The initial empty
stage capture and slow 326-primitive import remain in `out/` as local evidence.
The earlier import-only Studio playback/restart/frame-step smoke passed without
page errors in `out/studio-check-asYlvF/`; current follow-up evidence is in the
prototype README. These are functional desktop checks, not frame-rate tests.
Nothing has been installed into the workout app, approved as production exercise
instruction, or exported as a final MP4. The dark, armoured character also needs
beginner readability review; visible detail is not the same as clear instruction.
