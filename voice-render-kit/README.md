# Form Coach — voice render kit  (for v4.7)

## If you already rendered ~908 or ~959 clips

You need **360 new clips (~£0.08–0.18)**: the numbers, re-rendered once per persona.

Why: numbers used to live in ONE shared folder rendered in the steady voice. So on
Warm or Energy you heard "Plank —" (your coach) "forty" (a different person)
"seconds" (your coach). Rep counts made it constant — that's the voice-swapping.
Numbers are now per-persona and always match the sentence around them.

1. unzip -o this kit over your voice-render-kit folder
2. ELEVENLABS_API_KEY=sk_... node render.mjs      (resumable; expect "360 rendered")
3. cp -r voice/ next to form-coach-v4.7.html, and open v4.7 in the browser

## Starting fresh
1. API key: elevenlabs.io → profile → API Keys
2. ELEVENLABS_API_KEY=sk_... node audition.mjs   → pick three voices
3. Put the three IDs into VOICES in render.mjs (steady / warm / energy)
4. ELEVENLABS_API_KEY=sk_... node render.mjs
5. Copy voice/ next to form-coach-v4.7.html and reload

## Which lines are clips, which are TTS
Clips: all coaching lines, numbers and rep counts spliced in the SAME voice, plan
and movement names. Deliberate TTS: the calibration verdict, the end-of-session
debrief, and the personal-record line (9 of 674 variants) — all fully dynamic, all
spoken while you're resting.
Any unexpected fallback logs itself: `AudioBank: TTS fallback — <key>: "..."`.

## Diagnosing voice problems
Paste into the console before a session — every line reports which path played:

  const _p = Audio.prototype.play;
  Audio.prototype.play = function(){ console.log("CLIP", this.src.split("/voice/")[1]); return _p.apply(this, arguments); };

Mixed personas in one sentence = a stale voice/ folder; re-copy it.
