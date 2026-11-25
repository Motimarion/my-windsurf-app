// שאלות רקע מינימליות לכל ערוץ (רשות).
// הקשר בלבד: לא משמשות לאבחון, לא משנות ציון ולא בוחרות פרשנות מסורתית.
import type { Background, ChannelId } from '../types';

export type BackgroundKey = keyof Background;

interface Question {
  key: BackgroundKey;
  label: string;
  options: string[];
}

const TIME = ['עד 2 דקות', '2–5 דקות', 'יותר מ־5 דקות'];
const EXPERIENCE = ['כמעט אין', 'מצייר/ת לפעמים', 'מצייר/ת הרבה או למדתי ציור'];

/** אילו שאלות רקע רלוונטיות לכל ערוץ. */
export const BACKGROUND_QUESTIONS: Record<ChannelId, Question[]> = {
  palmRight: [{ key: 'dominantHand', label: 'מה היד הדומיננטית שלך?', options: ['ימין', 'שמאל', 'שתיהן'] }],
  palmLeft: [{ key: 'dominantHand', label: 'מה היד הדומיננטית שלך?', options: ['ימין', 'שמאל', 'שתיהן'] }],
  handwriting: [
    { key: 'writingHand', label: 'באיזו יד כתבת?', options: ['ימין', 'שמאל'] },
    { key: 'handwritingSource', label: 'האם הטקסט הועתק?', options: ['הועתק מטקסט', 'כתיבה חופשית'] },
  ],
  drawingTree: [
    { key: 'treeMinutes', label: 'כמה זמן לקח הציור בערך?', options: TIME },
    { key: 'drawingExperience', label: 'מה הניסיון שלך בציור?', options: EXPERIENCE },
  ],
  drawingPerson: [
    { key: 'personMinutes', label: 'כמה זמן לקח הציור בערך?', options: TIME },
    { key: 'drawingExperience', label: 'מה הניסיון שלך בציור?', options: EXPERIENCE },
  ],
};

/** תוויות קצרות לדוח. */
export const BACKGROUND_LABELS: Record<BackgroundKey, string> = {
  dominantHand: 'יד דומיננטית',
  writingHand: 'היד שכתבה',
  handwritingSource: 'מקור הטקסט',
  treeMinutes: 'זמן ציור העץ',
  personMinutes: 'זמן ציור האדם',
  drawingExperience: 'ניסיון בציור',
};

export const BACKGROUND_NOTE = 'הקשר בלבד: לא משמש לאבחון, לא משנה ציונים ולא בוחר פרשנות.';

/** שאלות הרקע שנענו ורלוונטיות לערוץ, לתצוגה בדוח. */
export function backgroundFor(channel: ChannelId, bg: Background): { label: string; value: string }[] {
  return BACKGROUND_QUESTIONS[channel]
    .filter((q) => bg[q.key])
    .map((q) => ({ label: BACKGROUND_LABELS[q.key], value: String(bg[q.key]) }));
}

