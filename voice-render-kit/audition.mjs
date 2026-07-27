// audition.mjs — render ONE line in several voices so you can compare before
// committing to the full 908-clip run.
//
//   ELEVENLABS_API_KEY=sk_... node audition.mjs
//
// Writes audition/<voiceName>.mp3 for each candidate. Listen, pick your three
// favourites, put their IDs into VOICES in render.mjs, then run render.mjs.

import fs from "node:fs";

const KEY = process.env.ELEVENLABS_API_KEY;
if(!KEY){ console.error("Set ELEVENLABS_API_KEY first."); process.exit(1); }

// A representative coaching line — warm, second-person, a full sentence.
const LINE = "There — that's it. That's exactly right. Remember what that feels like.";

// A spread of well-regarded ElevenLabs voices to compare. Swap freely.
const CANDIDATES = {
  Rachel:  "21m00Tcm4TlvDq8ikWAM",
  Antoni:  "ErXwobaYiN019PkySvjV",
  Elli:    "MF3mGyEYCl7XYWbV9V6O",
  Josh:    "TxGEqnHWrfWFTfGW9XjX",
  Charlotte:"XB0fDUnXU5powFXDhCwa",
  Daniel:  "onwK4e9ZLuTAKqWW03F9",
};
const MODEL = "eleven_turbo_v2_5";

fs.mkdirSync("audition", { recursive: true });
for(const [name, id] of Object.entries(CANDIDATES)){
  try{
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method:"POST",
      headers:{ "xi-api-key":KEY, "Content-Type":"application/json" },
      body: JSON.stringify({ text:LINE, model_id:MODEL,
        voice_settings:{ stability:0.55, similarity_boost:0.75 } }),
    });
    if(!res.ok){ console.error(`  ${name}: ${res.status}`); continue; }
    fs.writeFileSync(`audition/${name}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`  ✓ audition/${name}.mp3`);
    await new Promise(r => setTimeout(r, 150));
  }catch(e){ console.error(`  ${name}: ${e}`); }
}
console.log("\nListen to the audition/ folder, then set VOICES in render.mjs.");
console.log(`(Audition spends ~${Object.keys(CANDIDATES).length * LINE.length} characters.)`);
