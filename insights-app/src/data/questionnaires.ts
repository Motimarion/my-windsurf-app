import type { BigFiveTrait, RiasecType } from '../types';

export interface LikertItem<K extends string> {
  id: string;
  text: string;
  scale: K;
  reverse: boolean;
}

/**
 * Mini-IPIP — 20 פריטים, 4 לכל תכונה (Donnellan et al., 2006).
 * פריטי IPIP נמצאים בנחלת הכלל (ipip.ori.org).
 * הנוסח העברי להלן הוא תרגום עבודה של הפרויקט ולא עבר תיקוף פסיכומטרי
 * (תרגום-חוזר, בדיקת מבנה גורמים). יש לסמן זאת בדוח.
 */
export const MINI_IPIP: LikertItem<BigFiveTrait>[] = [
  { id: 'ipip1', text: 'אני הנשמה של המסיבה.', scale: 'E', reverse: false },
  { id: 'ipip2', text: 'אני מזדהה עם רגשותיהם של אחרים.', scale: 'A', reverse: false },
  { id: 'ipip3', text: 'אני מבצע/ת מטלות מיד.', scale: 'C', reverse: false },
  { id: 'ipip4', text: 'יש לי מצבי רוח משתנים לעיתים קרובות.', scale: 'N', reverse: false },
  { id: 'ipip5', text: 'יש לי דמיון עשיר.', scale: 'I', reverse: false },
  { id: 'ipip6', text: 'אני לא מדבר/ת הרבה.', scale: 'E', reverse: true },
  { id: 'ipip7', text: 'בעיות של אנשים אחרים לא מעניינות אותי.', scale: 'A', reverse: true },
  { id: 'ipip8', text: 'לעיתים קרובות אני שוכח/ת להחזיר דברים למקומם.', scale: 'C', reverse: true },
  { id: 'ipip9', text: 'רוב הזמן אני רגוע/ה.', scale: 'N', reverse: true },
  { id: 'ipip10', text: 'רעיונות מופשטים לא מעניינים אותי.', scale: 'I', reverse: true },
  { id: 'ipip11', text: 'במסיבות אני מדבר/ת עם הרבה אנשים שונים.', scale: 'E', reverse: false },
  { id: 'ipip12', text: 'אני מרגיש/ה את הרגשות של אחרים.', scale: 'A', reverse: false },
  { id: 'ipip13', text: 'אני אוהב/ת סדר.', scale: 'C', reverse: false },
  { id: 'ipip14', text: 'אני מתרגז/ת בקלות.', scale: 'N', reverse: false },
  { id: 'ipip15', text: 'קשה לי להבין רעיונות מופשטים.', scale: 'I', reverse: true },
  { id: 'ipip16', text: 'אני נשאר/ת ברקע.', scale: 'E', reverse: true },
  { id: 'ipip17', text: 'אחרים לא באמת מעניינים אותי.', scale: 'A', reverse: true },
  { id: 'ipip18', text: 'אני עושה בלגן בדברים.', scale: 'C', reverse: true },
  { id: 'ipip19', text: 'לעיתים רחוקות אני מרגיש/ה מדוכדך/ת.', scale: 'N', reverse: true },
  { id: 'ipip20', text: 'אין לי דמיון טוב.', scale: 'I', reverse: true },
];

export const IPIP_SCALE_LABELS = [
  'לא מתאר אותי כלל',
  'לא מתאר אותי',
  'ניטרלי',
  'מתאר אותי',
  'מתאר אותי מאוד',
];

export const BIG_FIVE_NAMES: Record<BigFiveTrait, string> = {
  E: 'מוחצנות',
  A: 'נעימות',
  C: 'מצפוניות',
  N: 'נוירוטיות (רגישות רגשית)',
  I: 'אינטלקט / דמיון',
};

export const BIG_FIVE_DESCRIPTIONS: Record<BigFiveTrait, string> = {
  E: 'נטייה לחברותיות, אסרטיביות וחיפוש גירוי חברתי.',
  A: 'נטייה לשיתוף פעולה, אמפתיה והתחשבות.',
  C: 'נטייה לארגון, התמדה ועמידה במחויבויות.',
  N: 'נטייה לחוות רגשות שליליים ותנודות במצב הרוח.',
  I: 'פתיחות לרעיונות, דמיון וסקרנות אינטלקטואלית.',
};

/**
 * פריטי RIASEC — 30 פריטים, 5 לכל טיפוס.
 * חשוב: אלה פריטי הדגמה מקוריים שנכתבו לפרויקט על בסיס הגדרות הטיפוסים של Holland.
 * הם לא תוקפו ואינם מחליפים כלי מתוקף (למשל O*NET Interest Profiler או
 * סולמות הסמן הציבוריים של Armstrong et al., 2008). להחלפה לפני שימוש מחקרי.
 */
export const RIASEC_ITEMS: LikertItem<RiasecType>[] = [
  { id: 'r1', text: 'לתקן מכשיר חשמלי או מכני.', scale: 'R', reverse: false },
  { id: 'i1', text: 'לנתח נתונים כדי להבין תופעה.', scale: 'I', reverse: false },
  { id: 'a1', text: 'לכתוב סיפור, שיר או תסריט.', scale: 'A', reverse: false },
  { id: 's1', text: 'ללמד או להדריך קבוצה.', scale: 'S', reverse: false },
  { id: 'e1', text: 'לשכנע אנשים לתמוך ברעיון שלי.', scale: 'E', reverse: false },
  { id: 'c1', text: 'לארגן קבצים, טבלאות ורשומות.', scale: 'C', reverse: false },
  { id: 'r2', text: 'לבנות או להרכיב דברים בידיים.', scale: 'R', reverse: false },
  { id: 'i2', text: 'לערוך ניסוי מדעי.', scale: 'I', reverse: false },
  { id: 'a2', text: 'לעצב, לצייר או לצלם.', scale: 'A', reverse: false },
  { id: 's2', text: 'לעזור לאדם להתמודד עם בעיה אישית.', scale: 'S', reverse: false },
  { id: 'e2', text: 'להוביל צוות לעמידה ביעד.', scale: 'E', reverse: false },
  { id: 'c2', text: 'לבדוק מסמכים ולאתר טעויות.', scale: 'C', reverse: false },
  { id: 'r3', text: 'לעבוד בחוץ, בשטח או בטבע.', scale: 'R', reverse: false },
  { id: 'i3', text: 'לפתור חידות לוגיות או מתמטיות.', scale: 'I', reverse: false },
  { id: 'a3', text: 'לנגן, לשחק או להופיע.', scale: 'A', reverse: false },
  { id: 's3', text: 'להתנדב בקהילה.', scale: 'S', reverse: false },
  { id: 'e3', text: 'להקים מיזם או עסק.', scale: 'E', reverse: false },
  { id: 'c3', text: 'לנהל תקציב לפי נהלים ברורים.', scale: 'C', reverse: false },
  { id: 'r4', text: 'להפעיל כלי עבודה או מכונות.', scale: 'R', reverse: false },
  { id: 'i4', text: 'לקרוא מאמרים מקצועיים לעומק.', scale: 'I', reverse: false },
  { id: 'a4', text: 'להמציא רעיונות יצירתיים חדשים.', scale: 'A', reverse: false },
  { id: 's4', text: 'לטפל או לסייע לאנשים.', scale: 'S', reverse: false },
  { id: 'e4', text: 'לנהל משא ומתן.', scale: 'E', reverse: false },
  { id: 'c4', text: 'להזין נתונים בדייקנות.', scale: 'C', reverse: false },
  { id: 'r5', text: 'לשפץ או לבנות רהיט.', scale: 'R', reverse: false },
  { id: 'i5', text: 'לחקור כיצד פועלת מערכת מורכבת.', scale: 'I', reverse: false },
  { id: 'a5', text: 'לכתוב או לערוך תוכן לבמה או למסך.', scale: 'A', reverse: false },
  { id: 's5', text: 'להקשיב ולייעץ לחברים.', scale: 'S', reverse: false },
  { id: 'e5', text: 'למכור מוצר או שירות.', scale: 'E', reverse: false },
  { id: 'c5', text: 'לתכנן לוחות זמנים ולעקוב אחריהם.', scale: 'C', reverse: false },
];

export const RIASEC_SCALE_LABELS = [
  'לא הייתי נהנה/ית כלל',
  'לא הייתי נהנה/ית',
  'לא בטוח/ה',
  'הייתי נהנה/ית',
  'הייתי נהנה/ית מאוד',
];

export const RIASEC_NAMES: Record<RiasecType, string> = {
  R: 'מעשי (R)',
  I: 'חקרני (I)',
  A: 'אמנותי (A)',
  S: 'חברתי (S)',
  E: 'יזמי (E)',
  C: 'מנהלי־מסורתי (C)',
};

export const RIASEC_ORDER: RiasecType[] = ['R', 'I', 'A', 'S', 'E', 'C'];
export const BIG_FIVE_ORDER: BigFiveTrait[] = ['E', 'A', 'C', 'N', 'I'];
