// מצב למידה: מעבר תחנה אחר תחנה על דוגמה סינתטית, ותרגול עם משוב.
//
// עיקרון: כל "פלט ביניים" כאן הוא תוצאה של הרצת הפונקציות האמיתיות של המערכת על נתונים סינתטיים
// (בדיקת איכות, מדידות, שער, ניקוד, דוח). הדבר היחיד שנכתב ביד הוא תשובת המודל לדוגמה, והיא מסומנת כך.
// לא מוצגות "מחשבות" של מודל: רק קלט, פלט ושלבי עיבוד מפורשים.
import type { Gray } from './imageAnalysis';
import { assessQuality, computeInkFeatures, computedObservations } from './imageAnalysis';
import { buildRequest, compareWithHuman, parseResponse, REJECT_TEXT } from './bridge';
import { buildReport } from './report';
import { scoreScales, hollandCode } from './scoring';
import { BIG_FIVE_NAMES, BIG_FIVE_ORDER, MINI_IPIP, RIASEC_ITEMS, RIASEC_ORDER } from '../data/questionnaires';
import { traditionsFor } from '../data/channels';
import { claimById, LEVEL_LABELS } from '../data/evidence';
import { DEMO_BACKGROUND, DEMO_OBSERVATIONS, demoAnswers } from '../demo/synthetic';
import type { Observation, Session } from '../types';

export type Actor = 'קוד' | 'AI' | 'אדם';

/**
 * הלומדה ב־LAMMA (קורס פרטי בטיוטה). נפתחת רק למי שיש לו גישה לחשבון או לקורס — לא מבטיחים פתיחה ציבורית.
 * כותרת הקורס ב־25.11.2026: "מאחורי הדוח: פירוק תהליך AI מקצה לקצה".
 */
export const LAMMA_COURSE_URL = 'https://lamma.com/studio/course/c91dbff4-a672-4454-98d6-14e6ca3b5262';
export const LAMMA_COURSE_TITLE = 'מאחורי הדוח: פירוק תהליך AI מקצה לקצה';

/** כותרת מצב הלמידה: בלי המילה "אבחון" ככותרת, כדי לא לבלבל. */
export const LEARN_TITLE = 'דוח תובנות — הדגמה, לא אבחון';

export interface WalkStep {
  id: string;
  num: string;
  name: string;
  actor: Actor;
  input: string;
  action: string;
  /** פלט ביניים קריא: שורות קצרות. */
  output: string[];
  explain: string;
  /** פלט שנכתב ביד לדוגמה (ולא חושב) — מסומן בממשק. */
  handWritten?: boolean;
}

/**
 * "צילום" סינתטי של דף כתב יד, כמערך פיקסלים: דף בהיר עם 6 פסים כהים מקווקווים (כמו שורות כתב).
 * לא תמונה של אדם. נוצר בקוד כדי שבדיקת האיכות והמדידות ירוצו על משהו אמיתי.
 */
export function syntheticHandwritingPage(): Gray {
  const w = 400;
  const h = 560;
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inLine = [90, 160, 230, 300, 370, 440].some((top) => y >= top && y < top + 22);
      const ink = inLine && x > 40 && x < 360 && (x * 7 + y * 3) % 5 < 2;
      // רעש קל של נייר, דטרמיניסטי
      data[y * w + x] = ink ? 35 : 238 + ((x * 13 + y * 7) % 9);
    }
  }
  return { width: w, height: h, data };
}

/** תשובת מודל לדוגמה — נכתבה ביד כדי להדגים מה השער עושה. לא הופעל שום מודל. */
export const SAMPLE_MODEL_RESPONSE = `הנה התיאור:
{"observations":[
 {"featureId":"hw.slant","value":"קדימה (בכיוון הכתיבה)","confidence":"בינוני"},
 {"featureId":"hw.size","value":"בינוני","confidence":"גבוה"},
 {"featureId":"hw.spacing","value":"מרווח מאוד","confidence":"נמוך"},
 {"featureId":"hw.baseline","value":"לא ניתן לקבוע","reason":"זווית","confidence":"נמוך"},
 {"featureId":"hw.pressure","value":"חזק","confidence":"גבוה"}
],"imageUsable":true}
הכותב נראה אדם בטוח בעצמו.`;

const SOURCE_NAME: Record<Observation['source'], string> = { manual: 'סימון אנושי', computed: 'חישוב בקוד', demo: 'סימון אנושי (הדגמה)', ai: 'מודל' };

const fmt = (o: Observation) =>
  `${o.featureId} = ${o.value}${o.blockedBy ? ` (חסם: ${o.blockedBy})` : ''}${o.confidence ? ` · ביטחון שהמודל דיווח: ${o.confidence}` : ''}`;

/** מריץ את המערכת על הדוגמה הסינתטית ומחזיר את התחנות עם פלט הביניים של כל אחת. */
export function buildWalkthrough(): WalkStep[] {
  const page = syntheticHandwritingPage();
  const quality = assessQuality(page, 1200, 1680, 'page');
  const computed = computeInkFeatures(page, true);
  const computedObs = computedObservations('handwriting', computed);
  const request = buildRequest('handwriting');
  const gate = parseResponse(SAMPLE_MODEL_RESPONSE, 'handwriting', 'דוגמה (לא הופעל מודל)');
  const human = DEMO_OBSERVATIONS.handwriting ?? [];
  const cmp = compareWithHuman('handwriting', human, gate.accepted);
  const { ipip, riasec } = demoAnswers();
  const bf = scoreScales(MINI_IPIP, ipip, BIG_FIVE_ORDER);
  const ri = scoreScales(RIASEC_ITEMS, riasec, RIASEC_ORDER);
  // החלטה מפורשת בדוגמה: ערכי המודל הושוו לסימון האנושי ולא אומצו. לכן התצפיות שנבחרו לדוח הן החישוב בקוד
  // והסימון האנושי — ואותו אוסף בדיוק משמש גם לתחנת הראיות וגם לדוח, כדי שלא יופיע ערך בלי מקור מוסבר.
  // (למשל "מרווח": המודל כתב "מרווח מאוד" והשער דחה אותו; "מרווח" שבדוח הוא מהסימון האנושי.)
  const selected: Observation[] = [...computedObs, ...human];
  const trad = selected.flatMap((o) => traditionsFor('handwriting', o.featureId, o.value));

  const session: Session = {
    id: 'learn-demo',
    label: 'דוגמה סינתטית',
    isDemo: true,
    createdAt: 0,
    updatedAt: 0,
    consent: null,
    ipip,
    riasec,
    observations: { handwriting: selected },
    background: { ...DEMO_BACKGROUND },
  };
  const report = buildReport(session, [{ channel: 'handwriting', quality, computed }], 0);
  const qaFail = report.qa.filter((q) => q.status === 'fail').length;

  return [
    {
      id: 'input',
      num: '0',
      name: 'קלט',
      actor: 'אדם',
      input: 'דף כתב יד מצולם, ושאלות רקע (רשות).',
      action: 'המשתמש מעלה תמונה ועונה על שאלות הרקע. כאן: דף סינתטי שנוצר בקוד, לא צילום של אדם.',
      output: [
        `תמונה: ${page.width}×${page.height} פיקסלים (מוקטנת לניתוח)`,
        `רקע שדווח: יד כותבת ${DEMO_BACKGROUND.writingHand}, ${DEMO_BACKGROUND.handwritingSource}`,
      ],
      explain: 'שאלות הרקע נשמרות כהקשר בלבד. אף חישוב בהמשך לא קורא אותן, והן לא משנות ציון.',
    },
    {
      id: 'quality',
      num: '1',
      name: 'בדיקת איכות',
      actor: 'קוד',
      input: 'מערך הפיקסלים של התמונה.',
      action: 'חישוב בהירות ממוצעת, ניגודיות, חדות (שונות לפלסיאן) ורזולוציה, מול ספים קבועים לדף.',
      output: [...quality.checks.map((c) => `${c.label}: ${c.status === 'ok' ? 'תקין' : c.status === 'warn' ? 'אזהרה' : 'נכשל'} — ${c.detail}`), `סיכום: ${quality.overall === 'fail' ? 'לא יישלח למודל' : 'אפשר להמשיך'}`],
      explain: 'זו איכות התמונה כולה, ולא של מאפיין מסוים. תמונה שנכשלה לא נשלחת למודל.',
    },
    {
      id: 'measure',
      num: '2',
      name: 'מדידות פיקסלים',
      actor: 'קוד',
      input: 'אותה תמונה.',
      action: 'סף Otsu מפריד דיו מנייר; פרופיל הקרנה אופקי סופר שורות.',
      output: [`זוהו ${computed.textLines} שורות`, `כיסוי דיו: ${(computed.inkCoverage * 100).toFixed(1)}%`, ...computedObs.map(fmt)],
      explain: 'מה שאפשר לחשב בוודאות — מחושב בקוד, לא נשאל את המודל. לחץ כתיבה אינו נמדד: תמונה סטטית לא מראה אותו.',
    },
    {
      id: 'request',
      num: '3א',
      name: 'הרכבת הבקשה למודל',
      actor: 'קוד',
      input: 'שם הערוץ ורשימת המאפיינים והערכים המותרים.',
      action: 'הקוד מרכיב הנחיה סמויה והודעה. בלי שאלונים, ציונים, כינוי או פרשנויות.',
      output: request.split('\n').filter((l) => l.trim()).slice(-7),
      explain: 'המודל מקבל רשימה סגורה ומתבקש להחזיר JSON בלבד. אפשר לראות את הבקשה המלאה בכרטיס ה־AI בכל ערוץ.',
    },
    {
      id: 'model',
      num: '3',
      name: 'תשובת המודל',
      actor: 'AI',
      input: 'הבקשה והתמונה.',
      action:
        'המודל מחזיר טקסט. כאן זו תשובה לדוגמה שנכתבה ביד — לא הופעל מודל. בשימוש אמיתי בגשר הידני האדם מעביר את הבקשה והתמונה, והתמונה נשמרת אצל הספק לפי תנאיו.',
      output: SAMPLE_MODEL_RESPONSE.split('\n'),
      explain: 'שימו לב: יש טקסט לפני ה־JSON ואחריו, ערך שאינו ברשימה, ומאפיין שהוסר (לחץ). זה בדיוק מה שהשער בא לסנן.',
      handWritten: true,
    },
    {
      id: 'gate',
      num: '4',
      name: 'שער הרשימה הסגורה',
      actor: 'קוד',
      input: 'הטקסט שהמודל החזיר.',
      action: 'חילוץ ה־JSON, בדיקה של כל ערך מול הרשימה, ודחייה עם סיבה.',
      output: [
        ...gate.accepted.map((o) => `התקבל: ${fmt(o)}`),
        ...gate.rejected.map((r) => `נדחה: ${r.featureId} = ${r.value} — ${REJECT_TEXT[r.reason]}`),
        gate.extraText ? 'טקסט מחוץ ל־JSON ("הכותב נראה אדם בטוח בעצמו"): התעלמות מלאה' : 'אין טקסט מחוץ ל־JSON',
      ],
      explain: 'המסקנה על "ביטחון עצמי" לא נכנסת לשום מקום. ביטחון המודל נשמר כדיווח עצמי בלבד — הוא לא איכות התמונה ולא חוזק ראיות.',
    },
    {
      id: 'compare',
      num: '4א',
      name: 'השוואה לסימון האנושי',
      actor: 'קוד',
      input: 'ערכי המודל שעברו בשער, והסימון של אדם על אותה תמונה.',
      action: 'ספירת מאפיינים שבהם המודל והאדם בחרו אותו ערך.',
      output: [
        ...cmp.rows.filter((r) => r.human || r.ai).map((r) => `${r.label}: אדם ${r.human ?? '—'} · מודל ${r.ai ?? '—'}${r.agree === undefined ? '' : r.agree ? ' ✓' : ' ✗'}`),
        `הסכמה: ${cmp.agreement.agree} מתוך ${cmp.agreement.compared}`,
      ],
      explain: 'זה מדד לדיוק התיאור בלבד. גם הסכמה מלאה לא אומרת שלמאפיין יש משמעות פסיכולוגית.',
    },
    {
      id: 'select',
      num: '4ב',
      name: 'בחירת התצפיות לדוח',
      actor: 'אדם',
      input: 'ערכי המודל שעברו בשער, הסימון האנושי והמדידות בקוד.',
      action: 'המשתמש מחליט אם לאמץ את ערכי המודל. בדוגמה הזו הוא לא מאמץ: נשארים הסימון האנושי והמדידות.',
      output: selected.map((o) => `${o.featureId} = ${o.value} · מקור: ${SOURCE_NAME[o.source]}`),
      explain:
        'מכאן והלאה — מסורות, ראיות ודוח — הכול נגזר מהאוסף הזה בלבד. לכן "מרווח" שמופיע בהמשך מגיע מהסימון האנושי, ולא מהמודל: הערך של המודל ("מרווח מאוד") נדחה בשער.',
    },
    {
      id: 'scores',
      num: '5',
      name: 'ניקוד השאלונים',
      actor: 'קוד',
      input: 'תשובות סינתטיות ל־50 פריטים (1–5).',
      action: 'ניקוד הפוך לפי המפתח, ממוצע לכל סולם, קוד Holland.',
      output: [...bf.map((s) => `${BIG_FIVE_NAMES[s.key]}: ${s.mean?.toFixed(2) ?? 'חסר'}`), `קוד Holland: ${hollandCode(ri) ?? '—'}`],
      explain: 'הציון מחושב בקוד מהתשובות בלבד. שום תמונה, תשובת מודל או שאלת רקע לא נכנסות לחישוב.',
    },
    {
      id: 'evidence',
      num: '6',
      name: 'שליפת מסורות וראיות',
      actor: 'קוד',
      input: 'התצפיות שנבחרו לדוח (תחנה 4ב), ומאגרי המסורות והראיות.',
      action: 'לכל תצפית שיש לה טענה במסורת: שליפת הטענה ורמת הראיות שלה.',
      output: trad.length
        ? trad.map((t) => {
            const c = claimById(t.claimId)!;
            return `${t.text} — רמה ${c.level}: ${LEVEL_LABELS[c.level].short}`;
          })
        : ['אין טענות מסורתיות לערכים האלה'],
      explain: 'הטקסט מגיע ממאגר קבוע, לא מהמודל. כל מסורת מקושרת לטענה ברמה C או D: נחקרה ולא נתמכה, או לא נחקרה.',
    },
    {
      id: 'report',
      num: '7–9',
      name: 'שילוב, בקרת איכות ודוח',
      actor: 'קוד',
      input: 'כל מה שחושב עד כאן.',
      action: 'שילוב לפי נושאים, 10 בדיקות איכות, והרכבת הדוח בשלוש שכבות נפרדות.',
      output: [
        `שילוב: ${report.synthesis.total} טענות מסורתיות, ${report.synthesis.compared} הושוו לשאלון, ${report.synthesis.matched} באותו כיוון`,
        `בקרת איכות: ${report.qa.length} בדיקות, ${qaFail} נכשלו`,
        'בדוח: נתוני שאלון · תצפית חזותית · פרשנות מסורתית — כל אחד בנפרד',
      ],
      explain: 'התאמה בין מסורת לשאלון לא הופכת את המסורת לנכונה. הדוח מראה כמה התאמות היו יוצאות גם בניחוש.',
    },
  ];
}

// ---------- תרגול ----------

export interface ExerciseOption {
  id: string;
  text: string;
}

export interface Exercise {
  id: string;
  title: string;
  question: string;
  /** טקסט לתצוגה מעל האפשרויות (למשל תשובות של מודל). */
  material?: string[];
  options: ExerciseOption[];
  correct: string;
}

const JSON_OK = `{"observations":[{"featureId":"tree.trunk","value":"עבה","confidence":"גבוה"}],"imageUsable":true}`;
// חסר פסיק בין שני שדות. (שימו לב: סוגר חסר בסוף לבד לא מספיק כדי להפיל את השער — הוא מחלץ את הרשימה הפנימית.)
const JSON_BROKEN = `{"observations":[{"featureId":"tree.trunk" "value":"עבה"}],"imageUsable":true}`;
const JSON_OUT = `{"observations":[{"featureId":"tree.trunk","value":"עבה מאוד"}],"imageUsable":true}`;

export const EXERCISES: Exercise[] = [
  {
    id: 'json',
    title: 'זיהוי JSON לא תקין',
    question: 'שלוש תשובות של מודל על ציור עץ. איזו מהן השער יקבל בלי לדחות דבר?',
    material: [`א. ${JSON_OK}`, `ב. ${JSON_BROKEN}`, `ג. ${JSON_OUT}`],
    options: [
      { id: 'a', text: 'תשובה א' },
      { id: 'b', text: 'תשובה ב' },
      { id: 'c', text: 'תשובה ג' },
    ],
    correct: 'a',
  },
  {
    id: 'who-scores',
    title: 'מי מחשב את הציון',
    question: 'מי מחשב את ציון המוחצנות בדוח?',
    options: [
      { id: 'ai', text: 'מודל ה־AI, לפי התמונות' },
      { id: 'code', text: 'תחנת קוד, מתשובות השאלון' },
      { id: 'human', text: 'החוקר, לפי התרשמות' },
    ],
    correct: 'code',
  },
  {
    id: 'unsupported',
    title: 'מסקנה בלי תמיכה',
    question: 'איזה משפט הוא מסקנה שאין לה תמיכה מחקרית?',
    options: [
      { id: 'obs', text: 'בציור העץ מצוירים שורשים.' },
      { id: 'q', text: 'ממוצע המוחצנות בשאלון הוא 4.2 מתוך 5.' },
      { id: 'claim', text: 'הכתב גדול, ולכן לכותב ביטחון עצמי גבוה.' },
    ],
    correct: 'claim',
  },
  {
    id: 'agreement',
    title: 'הסכמה בין מודלים',
    question: 'שלושה מודלים תיארו את "קו הראש" כמעוקל. מה זה מראה?',
    options: [
      { id: 'desc', text: 'שהתיאור עקבי; אין בכך הוכחה שהוא נכון' },
      { id: 'trait', text: 'שלאדם יש דמיון ויצירתיות' },
      { id: 'valid', text: 'שהקריאה בכף היד תקפה במקרה הזה' },
    ],
    correct: 'desc',
  },
  {
    id: 'pressure',
    title: 'מה אפשר לראות בצילום',
    question: 'מודל כתב: "לחץ הכתיבה חזק". מה השער עושה?',
    options: [
      { id: 'accept', text: 'מקבל, כי "חזק" הוא ערך ברור' },
      { id: 'reject', text: 'דוחה: לחץ כתיבה הוסר מהרשימה, כי תמונה סטטית לא מראה אותו' },
      { id: 'ask', text: 'שואל את המשתמש אם הוא לחץ חזק' },
    ],
    correct: 'reject',
  },
];

/** משוב שמסביר למה. בתרגיל ה־JSON המשוב מחושב מהשער עצמו, לא כתוב מראש. */
export function feedback(ex: Exercise, choice: string): { correct: boolean; text: string } {
  const correct = choice === ex.correct;
  switch (ex.id) {
    case 'json': {
      const res = { a: JSON_OK, b: JSON_BROKEN, c: JSON_OUT }[choice as 'a' | 'b' | 'c'];
      const g = parseResponse(res ?? '', 'drawingTree', 'תרגול');
      const what = g.error
        ? `השער החזיר שגיאה: "${g.error}"`
        : g.rejected.length
          ? `השער דחה: ${g.rejected.map((r) => `${r.value} — ${REJECT_TEXT[r.reason]}`).join('; ')}`
          : `השער קיבל: ${g.accepted.map((o) => `${o.featureId} = ${o.value}`).join(', ')}`;
      return {
        correct,
        text: correct
          ? `נכון. ${what}. ב' חסר פסיק בין "featureId" ל־"value", ולכן אינו JSON תקין. ג' משתמש בערך שאינו ברשימה הסגורה.`
          : `לא בדיוק. ${what}. רק תשובה א' היא JSON שלם עם ערך מהרשימה.`,
      };
    }
    case 'who-scores':
      return {
        correct,
        text: correct
          ? 'נכון. הציון הוא ממוצע של תשובות השאלון, אחרי ניקוד הפוך, בתחנת קוד. המודל לא רואה את השאלונים בכלל.'
          : 'לא. המודל לא רואה את השאלונים ולא משפיע על ציון, ואין שיפוט אישי. הציון מחושב בקוד מתשובות השאלון בלבד.',
      };
    case 'unsupported':
      return {
        correct,
        text: correct
          ? 'נכון. זו טענה גרפולוגית (רמה C): נחקרה, והמחקר לא מצא שכתב יד מנבא אישיות. שני המשפטים האחרים הם תיאור ונתון.'
          : `לא. ${choice === 'obs' ? '"שורשים מצוירים" הוא תיאור של מה שרואים, לא מסקנה.' : 'ממוצע בשאלון הוא נתון מדוד (עם המגבלות של תרגום שלא תוקף).'} המשפט על הכתב הגדול הוא מסקנה בלי תמיכה (רמה C).`,
      };
    case 'agreement':
      return {
        correct,
        text: correct
          ? 'נכון. הסכמה מראה שהתיאור עקבי, לא שהוא נכון: מודלים עלולים לטעות באותו כיוון (אותה תאורה, נתוני אימון דומים), ואין בהסכמה לבדה הסבר למקור טעות כזו. כדי לדעת אם הוא נכון משווים לסימון אנושי. ובוודאי שאין בה דבר על משמעות הקו — הקשר בין קו הראש ליצירתיות לא נחקר (רמה D).'
          : 'לא. הסכמה בין מודלים בודקת רק את התיאור, וגם אותו רק כעקביות — מודלים יכולים לטעות יחד. גם אם כולם מסכימים שהקו מעוקל, זה לא הופך את המסורת לתקפה (רמה D).',
      };
    case 'pressure':
      return {
        correct,
        text: correct
          ? 'נכון. השער דוחה מאפיין שהוסר, עם הסיבה "לא ניתן להסיק אותו מצילום". כהות הקו תלויה בעט, בנייר, בתאורה ובמצלמה.'
          : 'לא. לחץ כתיבה הוסר מהרשימה, והשער דוחה אותו בכל מקרה. תמונה סטטית לא מראה לחץ, והמערכת גם לא שואלת על זה.',
      };
    default:
      return { correct, text: correct ? 'נכון.' : 'לא נכון.' };
  }
}
