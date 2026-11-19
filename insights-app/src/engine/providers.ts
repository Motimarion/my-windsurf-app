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
  describe?: (blob: Blob, channel: ChannelId) => Promise<Observation[]>;
}

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
    id: 'claude-vision',
    name: 'Claude (מודל ראייה)',
    status: 'inactive',
    sendsDataOffDevice: true,
    note: 'לא מחובר. נדרש: שרת ביניים (backend) שמחזיק מפתח API, הסכמה מפורשת לשליחת תמונות לשירות חיצוני, מדיניות שמירת נתונים, והנחיה (prompt) שמגבילה את הפלט לתיאור מאפיינים מתוך הרשימה הסגורה בלבד.',
  },
  {
    id: 'gemini-vision',
    name: 'Gemini (מודל ראייה)',
    status: 'inactive',
    sendsDataOffDevice: true,
    note: 'לא מחובר. אותן דרישות כמו לספק Claude. מיועד לבדיקה צולבת של דיוק התיאור — לא לאימות תוקף פסיכולוגי.',
  },
];
