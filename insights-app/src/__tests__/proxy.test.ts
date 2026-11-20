import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../server/gemini-proxy/handler.js';
import engineRaw from '../../server/gemini-proxy/engine.json?raw';
import { ENGINE_SYSTEM_PROMPT, buildUserMessage, parseResponse } from '../engine/bridge';
import { CHANNELS } from '../data/channels';
import { callProxy, consumerEligibility } from '../engine/autoAi';

const engine = JSON.parse(engineRaw);
const ORIGIN = 'https://motimarion.github.io';
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const geminiText = (text: string) => json(200, { candidates: [{ content: { parts: [{ text }] } }] });

function setup(env: Record<string, string> = {}, reply = () => geminiText('{"observations":[]}')) {
  const fetchImpl = vi.fn<typeof fetch>(reply);
  const handle = createHandler({ env: { GEMINI_API_KEY: 'server-key', PAID_TIER: 'true', ...env }, engine, fetchImpl });
  return { handle, fetchImpl };
}
const post = (body: unknown = { channel: 'handwriting', mimeType: 'image/jpeg', data: 'QUJD' }, over = {}) => ({
  method: 'POST',
  origin: ORIGIN,
  ip: '10.0.0.1',
  body,
  ...over,
});

describe('engine.json: השרת שולח בדיוק את מה שהאפליקציה שולחת', () => {
  it('ההנחיה הסמויה והודעת המשתמש של כל ערוץ זהות (אחרי שינוי: npm run export:engine)', () => {
    expect(engine.systemPrompt).toBe(ENGINE_SYSTEM_PROMPT);
    for (const c of CHANNELS) {
      expect(engine.channels[c.id].userMessage).toBe(buildUserMessage(c.id));
      expect(engine.channels[c.id].personal).toBe(c.kind === 'palm');
    }
  });
});

describe('שרת Gemini של גרסת הצרכן', () => {
  it('מקור לא מורשה נחסם, בלי כותרות CORS ובלי פנייה ל־Gemini', async () => {
    const { handle, fetchImpl } = setup();
    const r = await handle(post(undefined, { origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
    expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('בקשת preflight ממקור מורשה מקבלת CORS', async () => {
    const { handle } = setup();
    const r = await handle({ method: 'OPTIONS', origin: ORIGIN });
    expect(r.status).toBe(204);
    expect(r.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
  });

  it('שולח את ההנחיה הסמויה, את הודעת הערוץ ואת התמונה, והמפתח רק בכותרת', async () => {
    const { handle, fetchImpl } = setup({ GEMINI_MODEL: 'gemini-3.8-flash' });
    const r = await handle(post());
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ text: '{"observations":[]}', model: 'gemini-3.8-flash' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/models/gemini-3.8-flash:generateContent');
    expect(String(url)).not.toContain('server-key');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('server-key');
    const sent = JSON.parse(init!.body as string);
    expect(sent.systemInstruction.parts[0].text).toBe(ENGINE_SYSTEM_PROMPT);
    expect(sent.contents[0].parts[0].text).toBe(buildUserMessage('handwriting'));
    expect(sent.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'QUJD' });
  });

  it('ערוץ, סוג קובץ ונתונים לא תקינים נדחים בלי לפנות ל־Gemini', async () => {
    const { handle, fetchImpl } = setup();
    expect((await handle(post({ channel: 'x', mimeType: 'image/jpeg', data: 'QUJD' }))).status).toBe(400);
    expect((await handle(post({ channel: 'handwriting', mimeType: 'text/html', data: 'QUJD' }))).status).toBe(400);
    expect((await handle(post({ channel: 'handwriting', mimeType: 'image/jpeg', data: 'not base64!' }))).status).toBe(400);
    expect((await handle(post({ channel: 'handwriting', mimeType: 'image/jpeg', data: 'A'.repeat(7_000_004) }))).status).toBe(413);
    expect((await handle(post('טקסט חופשי'))).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('כף יד נדחית כשהמפתח לא בפרויקט עם חיוב (תנאי Gemini API), וכתב יד עובר', async () => {
    const { handle } = setup({ PAID_TIER: 'false' });
    const palm = await handle(post({ channel: 'palmRight', mimeType: 'image/jpeg', data: 'QUJD' }));
    expect(palm.status).toBe(403);
    expect(JSON.parse(palm.body).error).toBe('personal-needs-paid');
    expect((await handle(post())).status).toBe(200);
  });

  it('מגבלת קצב לכל כתובת ומכסה יומית', async () => {
    const { handle } = setup({ RATE_PER_IP: '2', DAILY_LIMIT: '3' });
    expect((await handle(post())).status).toBe(200);
    expect((await handle(post())).status).toBe(200);
    expect(JSON.parse((await handle(post())).body).error).toBe('rate');
    expect((await handle(post(undefined, { ip: '10.0.0.2' }))).status).toBe(200);
    expect(JSON.parse((await handle(post(undefined, { ip: '10.0.0.3' }))).body).error).toBe('daily');
  });

  it('שגיאות של Gemini ותשובה ריקה מתורגמות לקודים קבועים', async () => {
    expect(JSON.parse((await setup({}, () => json(429, {})).handle(post())).body).error).toBe('quota');
    expect((await setup({}, () => json(500, {})).handle(post())).status).toBe(502);
    const blocked = await setup({}, () => json(200, { promptFeedback: { blockReason: 'SAFETY' } })).handle(post());
    expect(JSON.parse(blocked.body)).toEqual({ error: 'empty', reason: 'SAFETY' });
    expect((await setup({}, () => Promise.reject(new Error('down'))).handle(post())).status).toBe(502);
  });

  it('מפתח עם ירידת שורה בסוף (הדבקה לסוד) עובד', async () => {
    const { handle, fetchImpl } = setup({ GEMINI_API_KEY: 'server-key\n' });
    expect((await handle(post())).status).toBe(200);
    expect((fetchImpl.mock.calls[0][1]!.headers as Record<string, string>)['x-goog-api-key']).toBe('server-key');
  });

  it('בלי מפתח בשרת — שגיאת הגדרה, לא פנייה ל־Gemini', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handle = createHandler({ env: {}, engine, fetchImpl });
    expect((await handle(post())).status).toBe(500);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('האפליקציה מול השרת (גרסת הצרכן)', () => {
  const img = new Blob([new Uint8Array([65, 66, 67])], { type: 'image/jpeg' });

  it('שולחת ערוץ ותמונה בלבד, ומחזירה טקסט שעובר באותו שער', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      json(200, { text: '{"observations":[{"featureId":"hw.size","value":"גדול"},{"featureId":"hw.size","value":"ענק"}]}', model: 'm' }),
    );
    const r = await callProxy({ url: 'https://proxy.example/describe', channel: 'handwriting', blob: img, fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1]!.body as string)).toEqual({ channel: 'handwriting', mimeType: 'image/jpeg', data: 'QUJD' });
    const gate = parseResponse(r.text, 'handwriting', `Gemini · ${r.model}`);
    expect(gate.accepted).toHaveLength(1);
    expect(gate.rejected).toHaveLength(1);
  });

  it('מתרגמת שגיאות של השרת לעברית', async () => {
    const call = (status: number, error: string) =>
      callProxy({ url: 'u', channel: 'handwriting', blob: img, fetchImpl: () => json(status, { error }) });
    await expect(call(429, 'rate')).rejects.toThrow('נשלחו הרבה תמונות');
    await expect(call(403, 'personal-needs-paid')).rejects.toThrow('צילומי כף יד');
    await expect(call(502, 'upstream')).rejects.toThrow('לא זמין כרגע');
    await expect(callProxy({ url: 'u', channel: 'handwriting', blob: img, fetchImpl: () => Promise.reject(new Error('x')) })).rejects.toThrow(
      'אין חיבור',
    );
  });

  it('קודם בדיקת איכות: תמונה שנכשלה לא נשלחת, ובלי כתובת שרת לא נשלח דבר', () => {
    expect(consumerEligibility('fail', 'https://p').ok).toBe(false);
    expect(consumerEligibility('warn', 'https://p').ok).toBe(true);
    expect(consumerEligibility('ok', '').ok).toBe(false);
    expect(consumerEligibility(undefined, 'https://p').ok).toBe(false);
  });
});
