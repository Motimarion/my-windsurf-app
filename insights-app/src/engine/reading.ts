// "פרשנות משולבת" — סיכום בשפה פשוטה בסוף הדוח של גרסת הצרכן.
// מחבר את השאלונים ואת הפרשנות המסורתית (כף יד, גרפולוגיה, ציורים) לסיפור אחד, כמו סיכום של דוח אבחון.
// מסומן בבירור כפסאודו־מדע. כל משפט נגזר מציון בשאלון או מטענה מסורתית שבשלב השילוב — אין כאן טקסט חופשי.
import type { Direction, Report, RiasecType, SynthesisEntry, SynthesisTheme, ThemeId } from '../types';
import { RIASEC_TEXT } from '../data/reportText';
import { chanceAtLeast } from './synthesis';

type ScoredTheme = Exclude<ThemeId, 'other'>;
type DirKey = '1' | '0' | '-1';

/** מה עולה מהשאלון בכל נושא, כצירוף שמתאים אחרי "תמונה של". */
const QUESTIONNAIRE_PHRASE: Record<ScoredTheme, Record<DirKey, string>> = {
  extraversion: {
    '1': 'פתיחות, חברותיות ואנרגיה בחברה',
    '0': 'איזון בין צורך בחברה לצורך בשקט',
    '-1': 'העדפה לשקט, למסגרות קטנות ולפחות במה',
  },
  warmth: {
    '1': 'חום, אכפתיות והתחשבות באחרים',
    '0': 'התחשבות באחרים לצד מיקוד בעניינים אישיים',
    '-1': 'מיקוד בעניינים אישיים, ופחות עיסוק ברגשות של אחרים',
  },
  order: {
    '1': 'סדר, שיטתיות והקפדה על משימות',
    '0': 'סדר במידה, בלי הקפדה על כל פרט',
    '-1': 'ספונטניות, ופחות הקפדה על סדר ותכנון',
  },
  stability: {
    '1': 'רוגע ויציבות רגשית',
    '0': 'תגובה ממוצעת ללחץ ולשינויים',
    '-1': 'רגישות ללחץ ולתנודות במצב הרוח',
  },
  imagination: {
    '1': 'דמיון, יצירתיות וסקרנות לרעיונות',
    '0': 'שילוב של סקרנות ומעשיות',
    '-1': 'מעשיות והתמקדות במוחשי',
  },
};

/** שם תחום העניין במשפט רגיל (בלי אותיות הקוד). */
const DOMAIN: Record<RiasecType, string> = {
  R: 'התחום המעשי',
  I: 'התחום החקרני',
  A: 'התחום האמנותי',
  S: 'התחום החברתי',
  E: 'התחום היזמי',
  C: 'התחום המנהלי',
};

/** שם המסורת כפי שהוא נשמע בסיפור, לפי תחילת הניסוח במאגר המסורות. */
const SOURCE_NAME: [prefix: string, name: string][] = [
  ['במסורת הציורים ההשלכתיים', 'לפי פרשנות הציורים'],
  ['בפרשנות ציור הדמות', 'לפי פרשנות ציור הדמות'],
  ['במבחן העץ', 'לפי מבחן העץ'],
  ['ב־HTP', 'לפי מבחן בית־עץ־אדם'],
  ['בגרפולוגיה', 'לפי הגרפולוגיה'],
];

export const READING_NOTICE = {
  title: 'חשוב לדעת: החלק המסורתי אינו מדע',
  text:
    'קריאה בכף היד, גרפולוגיה ופירוש ציורים הן מסורות פסאודו־מדעיות. המחקר לא מצא שהן מנבאות אישיות או התאמה לעבודה. ' +
    'הן משולבות כאן כדי שיהיה אפשר לקרוא הכול יחד, ולא כי יש להן תוקף. אין לקבל החלטות על סמך החלק המסורתי.',
};

export const READING_LEAD =
  'כאן כל המקורות מחוברים לסיפור אחד, כמו בסיכום של דוח אבחון. בכל נושא מופיע קודם מה עלה בשאלון, ' +
  'אחר כך מה המסורות ״קוראות״ בכף היד, בכתב ובציורים, ולבסוף אם שני הצדדים מסכימים. ' +
  'השאלון מופיע ראשון, כי הוא הכלי היחיד כאן שנבדק במחקר.';

export const EXTRA_NOTE = 'לסימנים האלה אין מקבילה בשאלונים, ולכן אי אפשר לבדוק אותם.';

type Noted = Pick<SynthesisEntry, 'note'>;

/** מפרק "בגרפולוגיה נטען שכתב גדול מבטא..." לשם המסורת ("לפי הגרפולוגיה") ולטענה עצמה. */
function splitClaim(e: Noted): { name: string; clause: string } | null {
  const text = e.note.text.trim();
  const i = text.indexOf('נטען ש');
  if (i < 0) return null;
  const prefix = text.slice(0, i).trim();
  const name =
    e.note.channel === 'palm'
      ? 'לפי הקריאה בכף היד'
      : (SOURCE_NAME.find(([p]) => prefix.startsWith(p))?.[1] ?? `לפי ${prefix.replace(/^ב/, '')}`);
  return { name, clause: text.slice(i + 'נטען ש'.length).trim() };
}

/** "בגרפולוגיה נטען שכתב גדול מבטא..." ← "לפי הגרפולוגיה, כתב גדול מבטא..." */
export function plainClaim(e: Noted): string {
  const p = splitClaim(e);
  return p ? `${p.name}, ${p.clause}` : e.note.text.trim();
}

/** משפט אחד לכל מסורת: "לפי הגרפולוגיה, א, וב." טענה עם יותר ממשפט אחד (למשל הערה בסוגריים) נשארת נפרדת. */
export function mergeClaims(entries: Noted[]): string[] {
  const order: string[] = [];
  const bySource = new Map<string, string[]>();
  const loose: string[] = [];
  for (const e of entries) {
    const p = splitClaim(e);
    if (!p) {
      if (!loose.includes(e.note.text.trim())) loose.push(e.note.text.trim());
      continue;
    }
    if (!bySource.has(p.name)) {
      bySource.set(p.name, []);
      order.push(p.name);
    }
    const list = bySource.get(p.name)!;
    if (!list.includes(p.clause)) list.push(p.clause);
  }
  const oneSentence = (c: string) => /^[^.]*\.$/.test(c);
  const out: string[] = [];
  for (const name of order) {
    const clauses = bySource.get(name)!;
    const simple = clauses.filter(oneSentence).map((c) => c.slice(0, -1));
    if (simple.length > 1) out.push(`${name}, ${simple.slice(0, -1).join(', ')}, ו${simple[simple.length - 1]}.`);
    else if (simple.length === 1) out.push(`${name}, ${simple[0]}.`);
    for (const c of clauses.filter((c) => !oneSentence(c))) out.push(`${name}, ${c}`);
  }
  return [...out, ...loose];
}

export interface ReadingParagraph {
  id: ScoredTheme;
  title: string;
  /** מה עלה מהשאלון (null כשאין לנושא ציון). */
  questionnaire: string | null;
  /** הטענות המסורתיות בנושא, משפט לכל טענה, בלי כפילויות (למשל אותה טענה על שתי הידיים). */
  claims: string[];
  /** הפסקה כפי שהיא מוצגת: השאלון, הטענות (מאוחדות לפי מסורת) וההכרעה. */
  story: string;
  /** איך הטענות מסתדרות עם השאלון. */
  verdict: string;
  tone: 'agree' | 'disagree' | 'mixed' | 'open' | 'questionnaire-only';
}

export interface Reading {
  notice: { title: string; text: string };
  lead: string;
  paragraphs: ReadingParagraph[];
  /** טענות בלי מקבילה בשאלון, מאוחדות לפי מסורת. */
  extra: string[];
  /** תחומי העניין (מהשאלון בלבד). */
  work: string | null;
  closing: string[];
}

const dirKey = (d: Direction) => String(d) as DirKey;
const unique = (xs: string[]) => [...new Set(xs)];

/** "של א" / "של א; ושל ב" / "של א; של ב; ושל ג" — הצירופים עצמם מכילים פסיקים, ולכן ההפרדה בנקודה־פסיק. */
function joinOf(items: string[]): string {
  if (items.length === 1) return `של ${items[0]}`;
  return `${items
    .slice(0, -1)
    .map((x) => `של ${x}`)
    .join('; ')}; ושל ${items[items.length - 1]}`;
}

function domains(code: string): string {
  const [a, b] = [...code] as RiasecType[];
  return `${DOMAIN[a]}${b ? ` ו${DOMAIN[b]}` : ''}`;
}

function paragraph(t: SynthesisTheme): ReadingParagraph | null {
  if (t.id === 'other') return null;
  const questionnaire = t.dir === null ? null : `בשאלון האישיות עולה תמונה של ${QUESTIONNAIRE_PHRASE[t.id][dirKey(t.dir)]}.`;
  const claims = unique(t.entries.map(plainClaim));
  const match = t.entries.filter((e) => e.vs === 'match').length;
  const mismatch = t.entries.filter((e) => e.vs === 'mismatch').length;

  let tone: ReadingParagraph['tone'];
  let verdict: string;
  if (!claims.length) {
    if (!questionnaire) return null;
    tone = 'questionnaire-only';
    verdict = 'בתוצרים לא עלו סימנים שהמסורות קושרות לנושא הזה, ולכן התמונה כאן נשענת על השאלון בלבד.';
  } else if (t.dir === null) {
    tone = 'open';
    verdict = 'לנושא הזה אין ציון בשאלון, ולכן אי אפשר לבדוק את המסורות מול משהו שנמדד.';
  } else if (match && mismatch) {
    tone = 'mixed';
    verdict = 'חלק מהסימנים מסכימים עם השאלון וחלק לא, כך שהמסורות לא נותנות כאן תמונה אחידה. השאלון קובע.';
  } else if (match) {
    tone = 'agree';
    verdict = 'כאן המסורות והשאלון מספרים סיפור דומה.';
  } else if (mismatch) {
    tone = 'disagree';
    verdict = 'כאן המסורות והשאלון לא מסכימים. השאלון הוא הכלי שנבדק במחקר, ולכן כדאי לסמוך עליו.';
  } else if (t.dir === 0) {
    tone = 'open';
    verdict = 'בשאלון הנושא הזה באמצע הסולם, ולכן אין כיוון לבדוק מולו את המסורות.';
  } else {
    tone = 'open';
    verdict = 'הסימנים בתוצרים לא מצביעים לכיוון מסוים בנושא הזה, ולכן אין כאן מה להשוות.';
  }
  const story = [questionnaire, ...mergeClaims(t.entries), verdict].filter(Boolean).join(' ');
  return { id: t.id, title: t.title, questionnaire, claims, story, verdict, tone };
}

export function interpretiveReading(report: Report): Reading {
  const s = report.synthesis;
  const paragraphs = s.themes.map(paragraph).filter((p): p is ReadingParagraph => p !== null);
  const extra = mergeClaims(s.themes.find((t) => t.id === 'other')?.entries ?? []);

  let work: string | null = null;
  if (report.hollandCode) {
    const [a, b] = [...report.hollandCode] as RiasecType[];
    work =
      `בשאלון תחומי העניין בולטים ${domains(report.hollandCode)}: ${RIASEC_TEXT[a].desc}${b ? `, וגם ${RIASEC_TEXT[b].desc}` : ''}. ` +
      (report.hollandTie ? 'יש שוויון בין חלק מהתחומים, ולכן הסדר ביניהם אינו חד. ' : '') +
      `כיווני בדיקה: ${RIASEC_TEXT[a].fields}${b ? `; וגם ${RIASEC_TEXT[b].fields}` : ''}. ` +
      'בפרשנות המסורתית שבכלי אין טענות על תחום עיסוק, ולכן החלק הזה נשען על השאלון בלבד.';
  }

  const closing: string[] = [];
  const scored = s.themes.filter((t): t is SynthesisTheme & { id: ScoredTheme } => t.id !== 'other' && t.dir !== null);
  const marked = scored.filter((t) => t.dir === 1 || t.dir === -1);
  if (!scored.length) closing.push('שאלון האישיות לא הושלם, ולכן בסיכום אין תמונה אישיותית.');
  else if (!marked.length) closing.push('בסך הכול, בשאלון האישיות אין נושא שבולט במיוחד: רוב התשובות באמצע הסולם.');
  else closing.push(`בסך הכול, מהשאלונים עולה תמונה ${joinOf(marked.map((t) => QUESTIONNAIRE_PHRASE[t.id][dirKey(t.dir!)]))}.`);
  if (report.hollandCode) closing.push(`בתחומי העניין בולטים ${domains(report.hollandCode)}.`);

  if (s.compared > 0) {
    const p = Math.round(chanceAtLeast(s.matched, s.compared) * 100);
    closing.push(
      `המסורות על כף היד, הכתב והציורים הסכימו עם השאלון ב־${s.matched} מתוך ${s.compared} השוואות. ` +
        (p > 5
          ? `תוצאה כזו יוצאת גם בניחוש, בערך ב־${p}% מהפעמים.`
          : `תוצאה כזו נדירה בניחוש (${p}%), אבל אצל אדם אחד היא עדיין לא מוכיחה שהמסורות עובדות.`),
    );
  } else if (s.total > 0) closing.push('את מה שהמסורות קוראות בתוצרים לא היה אפשר להשוות לשאלון.');
  else closing.push('לא תוארו תוצרים, ולכן הסיכום נשען על השאלונים בלבד.');
  closing.push(
    'את החלק המסורתי אפשר לקרוא כסיפור וכנקודה לשיחה. החלטות, למשל על לימודים או עבודה, כדאי לבסס על השאלונים ועל שיחה עם איש מקצוע.',
  );

  return { notice: READING_NOTICE, lead: READING_LEAD, paragraphs, extra, work, closing };
}
