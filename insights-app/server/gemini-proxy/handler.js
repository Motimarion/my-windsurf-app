// השרת של גרסת הצרכן: מקבל תמונה אחת ושם ערוץ, ושולח ל־Gemini את אותה הנחיה סמויה שבאפליקציה.
// המפתח נשמר רק כאן (משתנה סביבה), והדפדפן לא רואה אותו. השרת לא שומר תמונות ולא כותב אותן ליומן.
// הלוגיקה כאן לא תלויה ב־Cloud Run, כדי שאפשר לבדוק אותה בבדיקות יחידה.

const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** כ־5MB של תמונה. האפליקציה שולחת עותק נקי של עד 2000 פיקסלים, בדרך כלל פחות מ־2MB. */
const MAX_B64 = 7_000_000;
const WINDOW_MS = 10 * 60 * 1000;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * @param {{ env: Record<string, string | undefined>, engine: { systemPrompt: string, channels: Record<string, { userMessage: string, personal: boolean }> }, fetchImpl?: typeof fetch, now?: () => number }} deps
 */
export function createHandler({ env, engine, fetchImpl = fetch, now = () => Date.now() }) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://motimarion.github.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const model = (env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const paid = env.PAID_TIER === 'true';
  const perIp = Number(env.RATE_PER_IP || 20);
  const dailyCap = Number(env.DAILY_LIMIT || 500);
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  let day = '';
  let dayCount = 0;

  /** @param {string | undefined} origin */
  const cors = (origin) =>
    origin && allowed.includes(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '3600',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };

  /** @param {number} status @param {string | undefined} origin @param {object} obj */
  const json = (status, origin, obj) => ({
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(obj),
  });

  /**
   * @param {{ method: string, origin?: string, ip?: string, body?: unknown }} req
   * @returns {Promise<{ status: number, headers: Record<string, string>, body: string }>}
   */
  return async function handle({ method, origin, ip = '', body }) {
    // מקור לא מורשה: בלי כותרות CORS, כך שדפדפן באתר אחר לא יוכל להשתמש במפתח.
    if (!origin || !allowed.includes(origin)) return json(403, origin, { error: 'origin' });
    if (method === 'OPTIONS') return { status: 204, headers: cors(origin), body: '' };
    if (method !== 'POST') return json(405, origin, { error: 'method' });
    if (!String(env.GEMINI_API_KEY ?? '').trim()) return json(500, origin, { error: 'config' });

    const { channel, mimeType, data } = /** @type {any} */ (body && typeof body === 'object' ? body : {});
    const ch = typeof channel === 'string' ? engine.channels[channel] : undefined;
    if (!ch) return json(400, origin, { error: 'channel' });
    if (!MIME.has(mimeType)) return json(400, origin, { error: 'mime' });
    if (typeof data !== 'string' || !data) return json(400, origin, { error: 'data' });
    if (data.length > MAX_B64) return json(413, origin, { error: 'size' });
    if (!B64.test(data)) return json(400, origin, { error: 'data' });
    // לפי תנאי Gemini API אין לשלוח מידע אישי לשירות ללא תשלום. כף יד נשלחת רק כשהמפתח בפרויקט עם חיוב.
    if (ch.personal && !paid) return json(403, origin, { error: 'personal-needs-paid' });

    // מגבלות שימוש, כדי שאף אחד לא ינצל את המפתח. לכל מופע של השרת בנפרד (best effort).
    const t = now();
    const d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) {
      day = d;
      dayCount = 0;
    }
    if (dayCount >= dailyCap) return json(429, origin, { error: 'daily' });
    const recent = (hits.get(ip) || []).filter((x) => t - x < WINDOW_MS);
    if (recent.length >= perIp) {
      hits.set(ip, recent);
      return json(429, origin, { error: 'rate' });
    }
    recent.push(t);
    hits.set(ip, recent);
    dayCount++;
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < WINDOW_MS)) hits.delete(k);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        // trim: מפתח שהודבק לסוד עם ירידת שורה בסוף לא יפיל את הבקשה.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env.GEMINI_API_KEY).trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: engine.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: ch.userMessage }, { inlineData: { mimeType, data } }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
    } catch {
      return json(502, origin, { error: 'upstream' });
    }
    /** @type {any} */
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      /* תשובה לא תקינה */
    }
    if (!res.ok) return json(res.status === 429 ? 429 : 502, origin, { error: res.status === 429 ? 'quota' : 'upstream' });
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((/** @type {any} */ p) => !p.thought && typeof p.text === 'string')
      .map((/** @type {any} */ p) => p.text)
      .join('')
      .trim();
    if (!text) {
      const reason = payload?.promptFeedback?.blockReason ?? payload?.candidates?.[0]?.finishReason ?? null;
      return json(502, origin, { error: 'empty', reason });
    }
    return json(200, origin, { text, model });
  };
}
