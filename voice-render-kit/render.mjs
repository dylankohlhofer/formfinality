// render.mjs — one-off neural voice render for Form Coach.
//
//   ELEVENLABS_API_KEY=sk_... node render.mjs
//
// Reads render-plan.json (~1199 clips, ~26k chars ≈ £2–6 one-off), renders each with
// ElevenLabs, and writes the voice/ tree exactly where the app's AudioBank looks:
//
//   voice/<persona>/<tier>/<key>_<variant>.mp3
//   voice/num/<n>.mp3
//   voice/manifest.json
//
// Then copy the whole voice/ folder next to form-coach-v4.7.html and reload.
// The AudioBank detects the manifest automatically and switches from TTS to clips.
// Any clip that fails just falls back to TTS — partial renders are fine.

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.ELEVENLABS_API_KEY;
if(!KEY){ console.error("Set ELEVENLABS_API_KEY first."); process.exit(1); }

// Pick a voice per persona at https://elevenlabs.io/voice-library — these are the
// defaults; swap the IDs for voices you actually like. Audition before rendering 881 clips.
const VOICES = {
  steady: "RlSVB64yXMZJjq67jbB1",   // calm, even
  warm:   "USEQXnsXRJlw2k9LUzG4",   // softer, warmer
  energy: "lKMAeQD7Brvj7QCWByqK",   // brighter, faster
};
const MODEL = "eleven_turbo_v2_5";   // fast + cheap; use eleven_multilingual_v2 for max quality

const plan = JSON.parse(fs.readFileSync(new URL("./render-plan.json", import.meta.url)));
console.log(`${plan.length} clips to render…`);

let done = 0, skipped = 0, failed = 0;
for(const item of plan){
  const out = item.path;                       // e.g. voice/steady/learning/sag_0.mp3
  if(fs.existsSync(out)){ skipped++; continue; }        // resumable — re-run after failures
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const persona = out.split("/")[1];
  const voiceId = VOICES[persona] || VOICES.steady;

  try{
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: item.text,
        model_id: MODEL,
        voice_settings: { stability: 0.55, similarity_boost: 0.75 },
      }),
    });
    if(!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    done++;
    if(done % 25 === 0) console.log(`  ${done}/${plan.length}…`);
    await new Promise(r => setTimeout(r, 120));         // stay under rate limits
  }catch(e){
    failed++;
    console.error(`  FAILED ${out}: ${String(e).slice(0, 120)}`);
  }
}

// the manifest is what flips the app from TTS to clips
const rendered = plan.map(p => p.path).filter(p => fs.existsSync(p));
fs.mkdirSync("voice", { recursive: true });
fs.writeFileSync("voice/manifest.json", JSON.stringify(rendered));
console.log(`\nDone: ${done} rendered, ${skipped} already existed, ${failed} failed.`);
console.log(`manifest.json lists ${rendered.length} clips.`);
console.log(`\nNow copy the voice/ folder next to form-coach-v4.7.html and reload.`);
