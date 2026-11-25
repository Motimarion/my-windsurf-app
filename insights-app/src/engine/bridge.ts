// תחנת מנוע ③ — "תיאור תמונה" דרך גשר ידני.
//
// האפליקציה לא שולחת דבר בעצמה. היא מרכיבה את הבקשה (הנחיה סמויה + רשימת המאפיינים והערכים המותרים),
// המשתמש מעביר אותה ואת התמונה למודל שהוא בוחר (Gemini, ChatGPT, Claude), ומדביק בחזרה את התשובה.
// תחנת קוד ("שער הרשימה הסגורה") מקבלת רק ערכים שמופיעים ברשימה, ומתעלמת מכל טקסט אחר — כולל פרשנות.
//
// במונחי הקורס: הקוד מחליט על הסדר; המשתמש משמש כ"קוד שמעביר בין התחנות"; המנוע רק מתאר.
import type { AiRun, BlockReason, ChannelId, CheckStatus, ModelConfidence, Observation, Session } from '../types';
import { BLOCK_REASONS, RETIRED_FEATURES, UNDETERMINED, activeObservations, channelById, isAllowedValue, normalizeValue } from '../data/channels';

/** ההנחיה הסמויה של תחנה ③. זהה למה שמתועד ב־docs/PROMPTS.md (נבדק בבדיקת יחידה). */
export const ENGINE_SYSTEM_PROMPT = `אתה מתאר תמונה עבור כלי מחקר. תפקידך לתאר בלבד — לא לפרש.

כללים:
1. לכל מאפיין ברשימה, בחר בדיוק ערך אחד מתוך הערכים המותרים לו, והעתק אותו מילה במילה.
2. אם אי אפשר לקבוע מאפיין מהתמונה — כתוב "לא ניתן לקבוע", והוסף "reason" עם אחת הסיבות: תאורה, טשטוש, הסתרה, זווית, אחר.
3. לכל מאפיין הוסף "confidence": גבוה, בינוני או נמוך — עד כמה הוא נראה בבירור בתמונה הזו.
4. אל תסיק מהתמונה לחץ כתיבה, מהירות או תנועה: תמונה סטטית לא מראה אותם.
5. אל תסיק דבר על אישיות, רגשות, בריאות, גיל, מגדר או עתיד של האדם.
6. אל תזכיר פרשנויות של כירומנטיה, גרפולוגיה או מבחנים השלכתיים.
7. אל תעתיק ואל תצטט טקסט שכתוב בתמונה.
8. החזר JSON בלבד, בלי טקסט נוסף, במבנה:
   {"observations":[{"featureId":"...","value":"...","confidence":"...","reason":"..."}],"imageUsable":true|false}`;

export const MODEL_CHOICES = ['Gemini', 'ChatGPT', 'Claude', 'אחר'] as const;

/** מאפיינים שהמנוע מתבקש לתאר: רק מה שלא מחושב בקוד. */
export const engineFeatures = (channel: ChannelId) => channelById(channel).features.filter((f) => !f.computed);

/** הודעת המשתמש של תחנה ③ — ללא שאלונים, ציונים, כינוי או פרשנויות. */
export function buildUserMessage(channel: ChannelId): string {
  const def = channelById(channel);
  const lines = engineFeatures(channel).map((f) => `- ${f.id} (${f.label}): ${[...f.options, UNDETERMINED].join(' | ')}`);
  return `ערוץ: ${def.title}\nמאפיינים וערכים מותרים:\n${lines.join('\n')}`;
}

/** הבקשה המלאה להדבקה בצ׳אט: ההנחיה הסמויה ואחריה הודעת המשתמש. */
export function buildRequest(channel: ChannelId): string {
  return [
    '[הנחיה סמויה — במוצר רגיל המשתמש לא רואה אותה. כאן היא גלויה כדי שתוכלו לבדוק אותה.]',
    ENGINE_SYSTEM_PROMPT,
    '',
    '[הבקשה — התמונה מצורפת להודעה]',
    buildUserMessage(channel),
  ].join('\n');
}

export type RejectReason = 'unknown-feature' | 'retired' | 'computed' | 'not-in-list' | 'duplicate' | 'bad-shape';

export const REJECT_TEXT: Record<RejectReason, string> = {
  'unknown-feature': 'מאפיין שלא קיים בערוץ הזה',
  retired: 'מאפיין שהוסר: לא ניתן להסיק אותו מצילום (למשל לחץ כתיבה)',
  computed: 'מאפיין שמחושב בקוד — לא המודל קובע אותו',
  'not-in-list': 'ערך מחוץ לרשימה הסגורה',
  duplicate: 'המאפיין הופיע פעמיים — נלקח הערך הראשון',
  'bad-shape': 'פריט בלי featureId ו־value',
};

export interface GateResult {
  /** שגיאה שמונעת קריאה של התשובה (אין JSON, מבנה שגוי). */
  error?: string;
  accepted: Observation[];
  rejected: { featureId: string; value: string; reason: RejectReason }[];
  /** האם הייתה בתשובה כתיבה מחוץ ל־JSON. השער מתעלם ממנה. */
  extraText: boolean;
  imageUsable?: boolean;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const CONFIDENCES: ModelConfidence[] = ['גבוה', 'בינוני', 'נמוך'];

/** מחזיר את סוף הקטע המאוזן שמתחיל ב־start (סוגריים מסולסלים ומרובעים, בהתחשב במחרוזות), או ‎-1. */
function balancedEnd(text: string, start: number): number {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return -1;
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * מחלץ JSON מתוך טקסט חופשי: עדיפות לאובייקט שיש בו observations, ואחריו למערך של אובייקטים.
 * מודלים בצ׳אט מוסיפים לעיתים הקדמה, סוגריים בטקסט או הסבר בסוף — כל אלה מדולגים.
 */
export function extractJson(text: string): { value: unknown; start: number; end: number } | null {
  let fallback: { value: unknown; start: number; end: number } | null = null;
  for (let s = 0; s < text.length; s++) {
    if (text[s] !== '{' && text[s] !== '[') continue;
    const end = balancedEnd(text, s);
    if (end < 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(text.slice(s, end));
    } catch {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && 'observations' in value) return { value, start: s, end };
    if (!fallback && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') fallback = { value, start: s, end };
  }
  return fallback;
}

/** שער הרשימה הסגורה: מקבל רק ערכים חוקיים, ומתעד כל דחייה עם סיבה. */
export function parseResponse(raw: string, channel: ChannelId, model: string): GateResult {
  const text = raw.replace(/```(?:json)?/gi, '');
  const found = extractJson(text);
  if (!found) {
    const error = /[{[]/.test(text)
      ? 'ה־JSON בתשובה לא תקין או לא שלם (חסר סוגר או מירכאה). העתיקו שוב את כל התשובה.'
      : 'לא נמצא בתשובה JSON. בקשו מהמודל: "החזר JSON בלבד, במבנה שבהנחיה".';
    return { error, accepted: [], rejected: [], extraText: !!text.trim() };
  }
  const data = found.value;
  const extraText = (text.slice(0, found.start) + text.slice(found.end)).trim().length > 0;
  const list = Array.isArray(data) ? data : (data as { observations?: unknown })?.observations;
  if (!Array.isArray(list)) {
    return { error: 'בתשובה אין רשימה בשם observations.', accepted: [], rejected: [], extraText };
  }
  const imageUsable = Array.isArray(data) ? undefined : (data as { imageUsable?: unknown }).imageUsable;

  const features = channelById(channel).features;
  const accepted: Observation[] = [];
  const rejected: GateResult['rejected'] = [];
  for (const item of list) {
    const fid = typeof item?.featureId === 'string' ? norm(item.featureId) : '';
    const value = typeof item?.value === 'string' ? norm(item.value) : '';
    if (!fid || !value) {
      rejected.push({ featureId: fid || '?', value: value || '?', reason: 'bad-shape' });
      continue;
    }
    const f = features.find((x) => x.id === fid);
    const v = normalizeValue(value);
    let reason: RejectReason | null = null;
    if (fid in RETIRED_FEATURES) reason = 'retired';
    else if (!f) reason = 'unknown-feature';
    else if (f.computed) reason = 'computed';
    else if (!isAllowedValue(f, v)) reason = 'not-in-list';
    else if (accepted.some((o) => o.featureId === fid)) reason = 'duplicate';
    if (reason) {
      rejected.push({ featureId: fid, value, reason });
      continue;
    }
    // שדות נלווים: נשמרים רק אם הם מהרשימה הקבועה. ערך אחר פשוט לא נשמר (לא דוחה את התצפית).
    const conf = typeof item?.confidence === 'string' ? norm(item.confidence) : '';
    const why = typeof item?.reason === 'string' ? norm(item.reason) : '';
    const obs: Observation = { featureId: fid, value: v, source: 'ai', model };
    if (CONFIDENCES.includes(conf as ModelConfidence)) obs.confidence = conf as ModelConfidence;
    if (v === UNDETERMINED) obs.blockedBy = BLOCK_REASONS.includes(why as BlockReason) ? (why as BlockReason) : 'אחר';
    accepted.push(obs);
  }
  return { accepted, rejected, extraText, imageUsable: typeof imageUsable === 'boolean' ? imageUsable : undefined };
}

export interface CompareRow {
  featureId: string;
  label: string;
  human?: string;
  ai?: string;
  agree?: boolean;
}

/** השוואה בין תיאור המודל לסימון האנושי — מדד לדיוק התיאור בלבד, לא לתוקף פסיכולוגי. */
export function compareWithHuman(channel: ChannelId, current: Observation[], aiObs: Observation[]) {
  const cur = activeObservations(current);
  const fromAi = activeObservations(aiObs);
  const rows: CompareRow[] = engineFeatures(channel).map((f) => {
    const human = cur.find((o) => o.featureId === f.id && (o.source === 'manual' || o.source === 'demo'))?.value;
    const ai = fromAi.find((o) => o.featureId === f.id)?.value;
    return { featureId: f.id, label: f.label, human, ai, agree: human && ai ? human === ai : undefined };
  });
  const compared = rows.filter((r) => r.agree !== undefined);
  return { rows, agreement: { agree: compared.filter((r) => r.agree).length, compared: compared.length } };
}

/** שומר את תיעוד ההרצה (רשומה אחת לכל ערוץ — האחרונה). */
export function recordRun(s: Session, run: AiRun): Session {
  return { ...s, aiRuns: [...(s.aiRuns ?? []).filter((r) => r.channel !== run.channel), run] };
}

/**
 * מתי אסור לאמץ ערכי מודל, גם אם כל ערך עבר בשער (ערך מהרשימה הוא תנאי הכרחי, לא מספיק):
 * אין תמונה, התמונה נכשלה בבדיקת האיכות, או שהמודל עצמו דיווח שהתמונה לא מתאימה לתיאור (imageUsable=false).
 * מחזיר את הסיבה, או null כשמותר.
 */
export function adoptionBlock(s: Session, channel: ChannelId, quality: CheckStatus | undefined): string | null {
  if (!quality) return 'אין תמונה בערוץ הזה, ולכן אין מה לתאר.';
  if (quality === 'fail') return 'התמונה נכשלה בבדיקת האיכות. ערכי המודל לא נכנסים לתצפיות — צלמו מחדש.';
  const run = (s.aiRuns ?? []).find((r) => r.channel === channel);
  if (run?.imageUsable === false) return 'המודל דיווח שהתמונה לא מתאימה לתיאור (imageUsable=false). ערכי המודל לא נכנסים לתצפיות.';
  return null;
}

/**
 * אימוץ ערכי המודל: מחליף את ערכי המאפיינים שהמודל תיאר, ומשאיר את השאר (כולל מה שחושב בקוד).
 * הבדיקה כאן ולא רק בכפתור: כשיש חסימה הפונקציה לא משנה דבר.
 */
export function adoptAi(s: Session, channel: ChannelId, aiObs: Observation[], quality: CheckStatus | undefined): Session {
  if (adoptionBlock(s, channel, quality)) return s;
  const ids = new Set(aiObs.map((o) => o.featureId));
  const kept = (s.observations[channel] ?? []).filter((o) => !ids.has(o.featureId));
  const runs = (s.aiRuns ?? []).map((r) => (r.channel === channel ? { ...r, adopted: true } : r));
  return { ...s, observations: { ...s.observations, [channel]: [...kept, ...aiObs] }, aiRuns: runs };
}

/** החלפה או מחיקה של תמונה מבטלות את תיעוד ההרצה ואת ערכי ה־AI שתיארו את התמונה הקודמת. */
export function clearAi(s: Session, channel: ChannelId): Session {
  const obs = s.observations[channel];
  return {
    ...s,
    aiRuns: (s.aiRuns ?? []).filter((r) => r.channel !== channel),
    observations: obs ? { ...s.observations, [channel]: obs.filter((o) => o.source !== 'ai') } : s.observations,
  };
}

/** אחרי שינוי בסימון האנושי: מחשב מחדש את ההסכמה בין המודל לאדם, לפי הערכים השמורים של ההרצה. */
export function refreshAgreement(s: Session, channel: ChannelId): Session {
  const runs = s.aiRuns ?? [];
  const run = runs.find((r) => r.channel === channel);
  if (!run?.values || run.adopted) return s;
  const { agreement } = compareWithHuman(channel, s.observations[channel] ?? [], run.values);
  return { ...s, aiRuns: runs.map((r) => (r === run ? { ...r, agreement } : r)) };
}
