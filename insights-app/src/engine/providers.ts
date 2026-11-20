// ממשק מודולרי לספקי "ראייה" (שכבה א׳).
// עיקרון: ספק שלא חובר מוצג כלא פעיל — לעולם לא מחזיר "ניתוח" מומצא.
import type { ChannelId, Observation } from '../types';

export type ProviderStatus = 'active' | 'inactive';

export interface VisionProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  /** מה הספק עושה בפועל ומה חסר כדי להפעיל אותו. */
  note: string;
  /** האם התמונה יוצאת מהמכשיר. */
  sendsDataOffDevice: boolean;
  /** התמונה יוצאת רק אם המשתמש עצמו מעביר אותה (האפליקציה לא שולחת דבר). */
  userTransfers?: boolean;
  /** כבוי כברירת מחדל; שולח רק אחרי שהמשתמש הפעיל אותו. */
  optIn?: boolean;
  describe?: (blob: Blob, channel: ChannelId) => Promise<Observation[]>;
}

/** טקסט לעמודה "מידע יוצא מהמכשיר" בטבלאות. */
export const dataLeavesText = (p: VisionProvider) =>
  p.userTransfers ? 'רק אם המשתמש מעביר' : p.optIn ? 'רק אם הופעל, אחרי בדיקת איכות' : p.sendsDataOffDevice ? 'כן' : 'לא';

export const PROVIDERS: VisionProvider[] = [
  {
    id: 'local-cv',
    name: 'ניתוח פיקסלים מקומי',
    status: 'active',
    sendsDataOffDevice: false,
    note: 'פועל בדפדפן בלבד: בדיקות איכות (תאורה, ניגודיות, חדות, רזולוציה), כיסוי דיו, גודל ומיקום הציור, ספירת שורות. אינו מזהה קווי כף יד או סגנון כתב.',
  },
  {
    id: 'manual',
    name: 'סימון תצפיות ידני',
    status: 'active',
    sendsDataOffDevice: false,
    note: 'המשתמש או החוקר מסמנים מה רואים בתמונה מתוך רשימה סגורה של מאפיינים תיאוריים.',
  },
  {
    id: 'manual-bridge',
    name: 'מודל AI חיצוני דרך גשר ידני (Gemini / ChatGPT / Claude)',
    status: 'active',
    sendsDataOffDevice: true,
    userTransfers: true,
    note: 'תחנת המנוע. האפליקציה מרכיבה את הבקשה (הנחיה סמויה ורשימה סגורה) ולא שולחת דבר בעצמה. המשתמש מעביר את הבקשה והתמונה למודל, אחרי הסכמה נפרדת, ומדביק את התשובה. תחנת קוד (שער) מקבלת רק ערכים מהרשימה ומשווה לסימון האנושי.',
  },
  {
    id: 'claude-vision',
    name: 'Claude דרך API (חיבור ישיר)',
    status: 'inactive',
    sendsDataOffDevice: true,
    note: 'לא מחובר. נדרש: שרת ביניים (backend) שמחזיק מפתח API, הסכמה מפורשת לשליחת תמונות לשירות חיצוני, מדיניות שמירת נתונים, ואותה הנחיה סמויה שבגשר הידני.',
  },
  {
    id: 'gemini-api',
    name: 'Gemini דרך API (מפתח אישי, שליחה אוטומטית)',
    status: 'active',
    sendsDataOffDevice: true,
    optIn: true,
    note: 'כבוי כברירת מחדל. מפעילים בכרטיס ה־AI עם מפתח API אישי והסכמה. אחרי בדיקת האיכות, כל תמונה שעברה נשלחת אוטומטית מהדפדפן ל־Google עם אותה הנחיה סמויה, והתשובה עוברת באותו שער. צילום כף יד נשלח רק עם מפתח בפרויקט עם חיוב פעיל, לפי תנאי Gemini API.',
  },
];
