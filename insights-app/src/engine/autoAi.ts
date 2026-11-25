// תחנת מנוע ③ במצב אוטומטי: Gemini API עם מפתח אישי של המשתמש.
//
// הסדר קבוע, והקוד קובע אותו: קליטה ובדיקת איכות (תחנה 1) → אם התמונה עברה, שליחה אוטומטית למנוע → שער הרשימה הסגורה (תחנה 4).
// המפתח נשמר רק בלשונית הנוכחית (sessionStorage), והבקשה נשלחת ישירות מהדפדפן ל־Google, בלי שרת ביניים.
import { useEffect, useState } from 'react';
import type { ChannelId, CheckStatus } from '../types';
import { channelById } from '../data/channels';
import { ENGINE_SYSTEM_PROMPT, buildUserMessage } from './bridge';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
export const MODEL_SUGGESTIONS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

export interface AutoSettings {
  enabled: boolean;
  key: string;
  model: string;
  /** הסכמה לשליחה אוטומטית של כל תמונה שעוברת את בדיקת האיכות. */
  consentAuto: boolean;
  /** המשתמש מאשר שהמפתח משויך לפרויקט עם חיוב פעיל (Paid Service). נדרש לצילומי כף יד. */
  paidTier: boolean;
}

export const EMPTY_SETTINGS: AutoSettings = { enabled: false, key: '', model: DEFAULT_MODEL, consentAuto: false, paidTier: false };

const STORE = 'insights-auto-ai';
const EVENT = 'insights-auto-ai-change';

export function loadAutoSettings(): AutoSettings {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? { ...EMPTY_SETTINGS, ...JSON.parse(raw) } : EMPTY_SETTINGS;
  } catch {
    return EMPTY_SETTINGS;
  }
}

export function saveAutoSettings(s: AutoSettings) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* אחסון לא זמין — ההגדרה תחזיק עד רענון */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** ההגדרות הנוכחיות, ועדכון בכל מקום במסך כשהן משתנות. */
export function useAutoSettings(): [AutoSettings, (s: AutoSettings) => void] {
  const [s, setS] = useState<AutoSettings>(loadAutoSettings);
  useEffect(() => {
    const h = () => setS(loadAutoSettings());
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return [s, saveAutoSettings];
}

const LOW_QUALITY = 'איכות התמונה נמוכה, ולכן היא לא נשלחה למודל. צלמו מחדש לפי הוראות הצילום.';

export type Eligibility = { ok: true } | { ok: false; reason: string; quality?: boolean };

/** האם לשלוח את התמונה אוטומטית. בדיקת האיכות קודמת לכול. */
export function autoEligibility(channel: ChannelId, quality: CheckStatus | undefined, s: AutoSettings): Eligibility {
  if (!s.enabled) return { ok: false, reason: 'השליחה האוטומטית כבויה.' };
  if (!s.key.trim()) return { ok: false, reason: 'חסר מפתח API.' };
  if (!s.consentAuto) return { ok: false, reason: 'לא אושרה שליחה אוטומטית.' };
  if (!quality) return { ok: false, reason: 'אין תמונה.' };
  if (quality === 'fail')
    return { ok: false, quality: true, reason: LOW_QUALITY };
  if (channelById(channel).kind === 'palm' && !s.paidTier)
    return {
      ok: false,
      reason:
        'צילום כף יד הוא מידע אישי. לפי תנאי Gemini API אין לשלוח מידע אישי בשכבה החינמית, ולכן כף יד נשלחת רק עם מפתח בפרויקט עם חיוב פעיל.',
    };
  return { ok: true };
}

export function buildGeminiBody(channel: ChannelId, base64: string, mimeType: string) {
  return {
    systemInstruction: { parts: [{ text: ENGINE_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserMessage(channel) }, { inlineData: { mimeType, data: base64 } }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };
}

export const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.trim() || DEFAULT_MODEL)}:generateContent`;

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

/** שולח תמונה אחת ל־Gemini ומחזיר את טקסט התשובה. שגיאות מוחזרות בעברית, עם הודעת השירות. */
export async function callGemini(opts: {
  key: string;
  model: string;
  channel: ChannelId;
  blob: Blob;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<string> {
  const f = opts.fetchImpl ?? fetch;
  const body = buildGeminiBody(opts.channel, await blobToBase64(opts.blob), opts.blob.type || 'image/jpeg');
  let res: Response;
  try {
    res = await f(geminiUrl(opts.model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key.trim() },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch {
    throw new Error('אין חיבור לשירות. בדקו את החיבור לאינטרנט.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg: string = data?.error?.message ?? `שגיאה ${res.status}`;
    if (res.status === 429) throw new Error(`המכסה נגמרה או שנשלחו יותר מדי בקשות. (${msg})`);
    if (/API key/i.test(msg)) throw new Error('מפתח ה־API לא תקין.');
    if (res.status === 404) throw new Error(`המודל ${opts.model} לא נמצא. נסו מודל אחר.`);
    throw new Error(msg);
  }
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  if (!text) {
    const reason = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason;
    throw new Error(reason ? `המודל לא החזיר תיאור (${reason}).` : 'המודל לא החזיר תיאור.');
  }
  return text;
}

// ---------- גרסת הצרכן: שליחה דרך השרת (server/gemini-proxy), בלי מפתח בדפדפן ----------

/** בגרסת הצרכן אין מפתח בדפדפן: רק בדיקת האיכות וכתובת שרת מחליטות אם לשלוח. */
export function consumerEligibility(quality: CheckStatus | undefined, proxyUrl: string): Eligibility {
  if (!proxyUrl) return { ok: false, reason: 'שירות התיאור עדיין לא מחובר.' };
  if (!quality) return { ok: false, reason: 'אין תמונה.' };
  if (quality === 'fail') return { ok: false, quality: true, reason: LOW_QUALITY };
  return { ok: true };
}

const PROXY_ERRORS: Record<string, string> = {
  rate: 'נשלחו הרבה תמונות בזמן קצר. נסו שוב בעוד כמה דקות.',
  daily: 'שירות התיאור הגיע למכסה היומית. נסו שוב מחר.',
  quota: 'שירות התיאור עמוס כרגע. נסו שוב בעוד כמה דקות.',
  origin: 'הכתובת הזו לא מורשית להשתמש בשירות התיאור.',
  'personal-needs-paid': 'שירות התיאור עדיין לא מוגדר לצילומי כף יד.',
  size: 'התמונה גדולה מדי. צלמו מחדש.',
  mime: 'סוג הקובץ לא נתמך.',
  channel: 'ערוץ לא מוכר.',
  data: 'התמונה לא נקראה. נסו להעלות אותה שוב.',
  config: 'שירות התיאור לא מוגדר. פנו למפעיל האתר.',
  empty: 'המודל לא החזיר תיאור לתמונה הזו.',
  upstream: 'שירות התיאור לא זמין כרגע. נסו שוב מאוחר יותר.',
};

export interface ProxyResult {
  text: string;
  model: string;
}

/** שולח לשרת של גרסת הצרכן תמונה אחת ושם ערוץ. ההנחיה הסמויה והרשימה הסגורה נמצאות בשרת. */
export async function callProxy(opts: {
  url: string;
  channel: ChannelId;
  blob: Blob;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<ProxyResult> {
  const f = opts.fetchImpl ?? fetch;
  const data = await blobToBase64(opts.blob);
  let res: Response;
  try {
    res = await f(opts.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: opts.channel, mimeType: opts.blob.type || 'image/jpeg', data }),
      signal: opts.signal,
    });
  } catch {
    throw new Error('אין חיבור לשירות התיאור. בדקו את החיבור לאינטרנט ונסו שוב.');
  }
  const payload: { text?: string; model?: string; error?: string } | null = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(PROXY_ERRORS[payload?.error ?? ''] ?? `שירות התיאור לא זמין כרגע (${res.status}). נסו שוב מאוחר יותר.`);
  }
  if (!payload?.text) throw new Error(PROXY_ERRORS.empty);
  return { text: payload.text, model: payload.model ?? 'Gemini' };
}

