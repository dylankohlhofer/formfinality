# Voice kit — mapping audit

**Method:** computed against the live build — every key the engine or shell can
speak, every clip the plan renders, every number and token the splicer can request,
checked in both directions. Not read; executed.

## Fixed in this pass

**The calibration verdict is now clips end to end.** It was the only dynamically
composed line in the core flow — the first thing a new user hears after the recorded
coach was a robot. Split into `calib.held` ("You held" + `<num>` + "seconds.") plus a
fixed per-tier `calibverdict` sentence. The on-screen copy is unchanged (it still shows
the score); only the spoken form changed shape. **27 new clips, ~£0.12–0.28.**

**Strong-tier rep counts now use num clips.** Every rep at Strong was spoken via
`raw()` — TTS numbers mid-set, a voice swap on every single rep, while `num/1–120`
sat rendered and unused. New `num` effect; falls back to TTS only if a clip is missing.

## A · Key reachability — one truly dead key

First pass flagged 8 dead keys; **6 were false positives** caused by extracting only
`say("…")`/`key:"…"` literals and missing dynamic references (`dir ? "turnside" :
"turnfront"`, plan steps' `pre:"switchsides"`, the POSITIVE-cues set holding
`encourage`/`pr`). The corrected test — the quoted key appearing anywhere in code —
leaves exactly one: **`breathe`**, defined at Learning, referenced nowhere. Pruned from
the render plan; the dialogue line stays harmlessly in source.

The false-positive episode is the audit's most useful lesson: *reachability pruning
must use the loosest plausible test, not the strictest.* Under-pruning wastes pennies;
over-pruning silently breaks features.

## B · Plan ↔ dialogue completeness — clean

Every reachable key resolves to a line at every tier for every persona, every line's
clip paths are in the plan, and every plan path traces back to a reachable line.
**1,294 clips** total: 878 dialogue + 78 tokens + 360 numbers − pruned dead entries −
`{v}` lines.

## C · Splice inputs — fully covered

The engine can request **37 distinct numbers** (scaled hold durations 11–68s, rep
targets 5–18, calibration 1–30, countdown) — all within the rendered `num/1–120` per
persona. Token clips cover all 26 movement and plan names; slugs are collision-free.

## D · Permanently TTS, by design

- **`pr` lines** — "That's the longest you've ever held it — {v}" carries a fully
  dynamic value; unrenderable, rare, celebratory. Acceptable.
- **Session-end summary** — composes the user's name and a dynamic headline. Names
  can't be pre-rendered.
- **The recording tool prompt** — developer-facing only.

These are the *only* TTS remaining, and each is TTS for a reason rather than by
accident.

## E · Housekeeping

~75 clips on your disk are now obsolete (old Warm takes of `breathe`, superseded
variants). Harmless — the app requests by manifest, never by directory listing — so
deleting is optional tidiness, not a fix.

## Next render

Drop the regenerated `render-plan-v4.8.json` over `render-plan.json` and run: **27
clips**, pennies. After that the entire core flow — welcome, calibration, verdict,
teaching, cueing, counting, debrief headline aside — is the recorded coach.
