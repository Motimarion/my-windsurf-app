// ניסוי בארנום (אפקט פורר) בדוח: שתי קריאות מסורתיות באותו אורך — אחת מהתצפיות של המשתמש,
// ואחת מאותם מאפיינים בערך אחר. המשתמש מדרג את שתיהן בלי לדעת איזו שלו, ורק אחר כך זה נחשף.
import type { Report, TraditionNote } from '../types';
import { TRADITIONS } from '../data/channels';

/**
 * החלק הפרשני של טענה מסורתית ("...מבטא X."), בלי התיאור של התוצר עצמו,
 * כדי שאי אפשר יהיה לזהות לפי הניסוח איזו קריאה נבנתה מהתוצרים של המשתמש.
 */
export function traitOf(t: TraditionNote): string {
  const m = /מבטא(?:ת|ים|ות)?\s+([^.]+)\./.exec(t.text);
  return (m ? m[1] : t.text).trim();
}

export interface BarnumPair {
  /** מה שהמסורות אומרות לפי התצפיות של המשתמש */
  own: TraditionNote[];
  /** מה שהן היו אומרות על אותם מאפיינים, אילו התוצר נראה אחרת */
  other: TraditionNote[];
}

/**
 * לכל מאפיין שיש לו טענה מסורתית אצל המשתמש: טענה על אותו מאפיין בערך אחר.
 * מאפיין בלי ערך חלופי לא נכנס לאף אחת מהקריאות, ולכן הן תמיד באותו אורך.
 */
export function barnumReadings(report: Report, max = 6): BarnumPair {
  const own: TraditionNote[] = [];
  const other: TraditionNote[] = [];
  const features = new Set<string>();
  const ownTraits = new Set<string>();
  const otherTraits = new Set<string>();
  for (const t of report.channels.flatMap((c) => c.traditions)) {
    if (own.length >= max) break;
    const key = `${t.channel}|${t.featureId}`;
    const trait = traitOf(t);
    if (features.has(key) || ownTraits.has(trait)) continue;
    const alt = TRADITIONS.find(
      (x) =>
        x.channel === t.channel &&
        x.featureId === t.featureId &&
        x.value !== t.value &&
        traitOf(x) !== trait &&
        !ownTraits.has(traitOf(x)) &&
        !otherTraits.has(traitOf(x)),
    );
    if (!alt) continue;
    features.add(key);
    ownTraits.add(trait);
    otherTraits.add(traitOf(alt));
    own.push(t);
    other.push(alt);
  }
  return { own, other };
}

/** סדר ההצגה קבוע לכל תהליך (לא מתחלף בטעינה מחדש), ונקבע לפי התו האחרון של המזהה. */
export const ownShownFirst = (sessionId: string) => (parseInt(sessionId.slice(-1), 16) || 0) % 2 === 0;

export type BarnumVerdict = 'similar' | 'own-higher' | 'other-higher';

/** הפרש של נקודה אחת או פחות נחשב "דומה". */
export function barnumVerdict(own: number, other: number): BarnumVerdict {
  const d = own - other;
  return d >= 2 ? 'own-higher' : d <= -2 ? 'other-higher' : 'similar';
}
