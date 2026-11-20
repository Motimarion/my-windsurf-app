import { describe, expect, it, vi } from 'vitest';
import { EMPTY_SETTINGS, autoEligibility, blobToBase64, buildGeminiBody, callGemini, geminiUrl } from '../engine/autoAi';
import { ENGINE_SYSTEM_PROMPT, buildUserMessage, parseResponse, recordRun, refreshAgreement } from '../engine/bridge';
import type { Session } from '../types';

const on = { ...EMPTY_SETTINGS, enabled: true, key: 'k', consentAuto: true };

describe('שליחה אוטומטית: בדיקת האיכות קודמת לכול', () => {
  it('תמונה באיכות נמוכה לא נשלחת, גם כשהכול מוגדר', () => {
    const e = autoEligibility('handwriting', 'fail', { ...on, paidTier: true });
    expect(e.ok).toBe(false);
    expect(e.ok === false && e.quality).toBe(true);
  });

  it('איכות תקינה או סבירה נשלחת', () => {
    expect(autoEligibility('handwriting', 'ok', on).ok).toBe(true);
    expect(autoEligibility('drawingTree', 'warn', on).ok).toBe(true);
  });

  it('כף יד נשלחת רק עם מפתח בפרויקט עם חיוב פעיל', () => {
    expect(autoEligibility('palmRight', 'ok', on).ok).toBe(false);
    expect(autoEligibility('palmLeft', 'ok', { ...on, paidTier: true }).ok).toBe(true);
  });

  it('בלי הפעלה, מפתח או הסכמה — לא נשלח', () => {
    expect(autoEligibility('handwriting', 'ok', { ...on, enabled: false }).ok).toBe(false);
    expect(autoEligibility('handwriting', 'ok', { ...on, key: '  ' }).ok).toBe(false);
    expect(autoEligibility('handwriting', 'ok', { ...on, consentAuto: false }).ok).toBe(false);
    expect(autoEligibility('handwriting', undefined, on).ok).toBe(false);
  });
});

describe('הבקשה ל־Gemini', () => {
  it('אותה הנחיה סמויה ואותה הודעה כמו בגשר הידני, והתמונה מצורפת', () => {
    const b = buildGeminiBody('drawingTree', 'QUJD', 'image/jpeg');
    expect(b.systemInstruction.parts[0].text).toBe(ENGINE_SYSTEM_PROMPT);
    expect(b.contents[0].parts[0]).toEqual({ text: buildUserMessage('drawingTree') });
    expect(b.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(b.generationConfig.responseMimeType).toBe('application/json');
  });

  it('כתובת לפי המודל, עם ברירת מחדל', () => {
    expect(geminiUrl('gemini-3.8-flash')).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(geminiUrl('  ')).toContain('/models/gemini-3.8-flash:');
  });

  it('base64 של התמונה', async () => {
    expect(await blobToBase64(new Blob([new Uint8Array([65, 66, 67])]))).toBe('QUJD');
  });
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const img = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

describe('קריאה ל־Gemini', () => {
  it('שולח את המפתח בכותרת ומחזיר רק את טקסט התשובה (בלי חלקי "מחשבה")', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      json(200, { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: '{"observations":[]}' }] } }] }),
    );
    const text = await callGemini({ key: ' secret ', model: 'gemini-3.8-flash', channel: 'handwriting', blob: img, fetchImpl });
    expect(text).toBe('{"observations":[]}');
    const init = fetchImpl.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret');
    expect(JSON.parse(init.body as string).contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
  });

  it('תשובה שעוברת בשער: רק ערכים מהרשימה', async () => {
    const fetchImpl = () =>
      json(200, {
        candidates: [{ content: { parts: [{ text: '{"observations":[{"featureId":"hw.size","value":"גדול"},{"featureId":"hw.size","value":"ענק"}]}' }] } }],
      });
    const text = await callGemini({ key: 'k', model: 'm', channel: 'handwriting', blob: img, fetchImpl: fetchImpl as typeof fetch });
    const r = parseResponse(text, 'handwriting', 'Gemini API · m');
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected).toHaveLength(1);
  });

  it('שגיאות מתורגמות: מפתח לא תקין, מכסה, מודל לא קיים, תשובה ריקה, אין רשת', async () => {
    const call = (f: () => Promise<Response>) => callGemini({ key: 'k', model: 'm', channel: 'handwriting', blob: img, fetchImpl: f as typeof fetch });
    await expect(call(() => json(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }))).rejects.toThrow('מפתח ה־API לא תקין');
    await expect(call(() => json(429, { error: { message: 'Resource exhausted' } }))).rejects.toThrow('המכסה נגמרה');
    await expect(call(() => json(404, { error: { message: 'not found' } }))).rejects.toThrow('המודל m לא נמצא');
    await expect(call(() => json(200, { promptFeedback: { blockReason: 'SAFETY' } }))).rejects.toThrow('SAFETY');
    await expect(call(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow('אין חיבור');
  });
});

describe('עדכון ההסכמה בין המודל לאדם אחרי סימון', () => {
  it('מחשב מחדש לפי הערכים השמורים של ההרצה', () => {
    const base: Session = {
      id: 's',
      label: '',
      isDemo: false,
      createdAt: 0,
      updatedAt: 0,
      consent: null,
      ipip: {},
      riasec: {},
      observations: { handwriting: [{ featureId: 'hw.size', value: 'גדול', source: 'manual' }] },
    };
    const withRun = recordRun(base, {
      channel: 'handwriting',
      model: 'Gemini API · m',
      at: 1,
      accepted: 1,
      rejected: 0,
      extraText: false,
      agreement: { agree: 0, compared: 0 },
      adopted: false,
      mode: 'auto',
      values: [{ featureId: 'hw.size', value: 'גדול', source: 'ai', model: 'Gemini API · m' }],
    });
    expect(refreshAgreement(withRun, 'handwriting').aiRuns![0].agreement).toEqual({ agree: 1, compared: 1 });
  });
});
