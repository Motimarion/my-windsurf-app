// מייצא לשרת (server/gemini-proxy/engine.json) את ההנחיה הסמויה ואת הודעת המשתמש של כל ערוץ.
// כך השרת לא מקבל מהדפדפן טקסט חופשי למודל, והבקשה ל־Gemini זהה בדיוק לזו שבאפליקציה.
// הרצה: npm run export:engine
import { writeFileSync } from 'node:fs';
import { CHANNELS } from '../src/data/channels';
import { ENGINE_SYSTEM_PROMPT, buildUserMessage } from '../src/engine/bridge';

const engine = {
  generatedBy: 'npm run export:engine (insights-app/scripts/export-engine.ts)',
  systemPrompt: ENGINE_SYSTEM_PROMPT,
  channels: Object.fromEntries(
    CHANNELS.map((c) => [c.id, { userMessage: buildUserMessage(c.id), personal: c.kind === 'palm' }]),
  ),
};

const out = new URL('../server/gemini-proxy/engine.json', import.meta.url);
writeFileSync(out, JSON.stringify(engine, null, 2) + '\n');
console.log(`engine.json: ${Object.keys(engine.channels).join(', ')}`);
