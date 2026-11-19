// שכבה ד׳ — חישוב שאלונים. פונקציות טהורות, ללא תלות ב־DOM, נבדקות ביחידה.
import type { LikertAnswers, ScaleScore } from '../types';
import type { LikertItem } from '../data/questionnaires';

/** ספי פרשנות מילולית על סולם 1–5. אלה אינם נורמות — רק חלוקה תיאורית של הסולם. */
export const BAND_LOW = 2.5;
export const BAND_HIGH = 3.5;

export function itemScore(raw: number, reverse: boolean): number {
  if (!Number.isInteger(raw) || raw < 1 || raw > 5) throw new RangeError(`ערך לא חוקי: ${raw}`);
  return reverse ? 6 - raw : raw;
}

export function bandOf(mean: number | null): ScaleScore<string>['band'] {
  if (mean === null) return null;
  if (mean < BAND_LOW) return 'low';
  if (mean > BAND_HIGH) return 'high';
  return 'mid';
}

/**
 * מחשב ממוצע לכל סולם. סולם שחסר בו פריט אחד או יותר מקבל mean=null
 * (מדיניות שמרנית: לא משלימים ערכים חסרים בשאלון של 4 פריטים לסולם).
 */
export function scoreScales<K extends string>(
  items: LikertItem<K>[],
  answers: LikertAnswers,
  order: K[],
): ScaleScore<K>[] {
  return order.map((key) => {
    const scaleItems = items.filter((i) => i.scale === key);
    const scored = scaleItems
      .filter((i) => answers[i.id] !== undefined)
      .map((i) => itemScore(answers[i.id], i.reverse));
    const complete = scored.length === scaleItems.length && scaleItems.length > 0;
    const mean = complete ? round2(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
    return { key, mean, answered: scored.length, total: scaleItems.length, band: bandOf(mean) as ScaleScore<K>['band'] };
  });
}

/** קוד Holland: שלושת הטיפוסים הגבוהים. בתיקו — נשמר הסדר הקנוני RIASEC (מיון יציב). */
export function hollandCode<K extends string>(scores: ScaleScore<K>[]): string | null {
  if (scores.some((s) => s.mean === null)) return null;
  return [...scores]
    .sort((a, b) => (b.mean as number) - (a.mean as number))
    .slice(0, 3)
    .map((s) => s.key)
    .join('');
}

export function progress(items: { id: string }[], answers: LikertAnswers) {
  const done = items.filter((i) => answers[i.id] !== undefined).length;
  return { done, total: items.length, ratio: items.length ? done / items.length : 0 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
