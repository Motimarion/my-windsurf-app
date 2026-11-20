import { describe, expect, it } from 'vitest';
import { buildReport } from '../engine/report';
import {
  interestLines,
  personalityLines,
  processLines,
  productLines,
  recommendationLines,
  strengthLines,
  summaryLines,
  toolsUsed,
} from '../engine/narrative';
import { CHANNELS, channelById } from '../data/channels';
import { demoAnswers, DEMO_OBSERVATIONS } from '../demo/synthetic';
import type { Session } from '../types';

const okQuality = { width: 1000, height: 1000, brightness: 200, contrast: 50, sharpness: 100, checks: [], overall: 'ok' as const };
const images = CHANNELS.map((c) => ({ channel: c.id, quality: okQuality }));
const demo = (over: Partial<Session> = {}): Session => ({
  id: 'd',
  label: 'בדיקה',
  isDemo: true,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ...demoAnswers(),
  observations: structuredClone(DEMO_OBSERVATIONS),
  ...over,
});

const allText = (s: Session, imgs = images) => {
  const r = buildReport(s, imgs);
  return {
    r,
    text: [
      ...processLines(r, s),
      ...personalityLines(r).map((l) => `${l.label} ${l.text}`),
      ...interestLines(r).map((l) => `${l.name} ${l.desc} ${l.fields}`),
      ...productLines(r).map((l) => l.text),
      ...summaryLines(r),
      ...strengthLines(r).map((l) => l.text),
      ...recommendationLines(r),
    ].join('\n'),
  };
};

describe('דוח במבנה של דוח אבחון — בלי אבחנות', () => {
  it('אין אבחנות או ניסוח של בודק שפגש את הנבדק', () => {
    const { text } = allText(demo());
    for (const w of ['דיסלקציה', 'דיסגרפיה', 'דיסקלקוליה', 'ADHD', 'הפרעת', 'לקות למידה', 'אובחן', 'התרשמתי', 'בפגישה עם']) {
      expect(text, w).not.toContain(w);
    }
  });

  it('ממצאי האישיות והחוזקות לא מזכירים את התוצרים החזותיים', () => {
    const r = buildReport(demo(), images);
    const t = [...personalityLines(r).map((l) => l.text), ...strengthLines(r).map((l) => l.text)].join(' ');
    for (const w of ['כף היד', 'כתב', 'ציור', 'גרפולוג', 'כירומנט']) expect(t, w).not.toContain(w);
  });

  it('תיאור התוצרים מכיל רק ערכים מהרשימה הסגורה', () => {
    const r = buildReport(demo(), images);
    for (const l of productLines(r)) {
      const def = channelById(l.channel);
      const obs = r.channels.find((c) => c.channel === l.channel)!.observations;
      for (const o of obs) expect(def.features.find((f) => f.id === o.featureId)!.options).toContain(o.value);
      expect(l.text.length).toBeGreaterThan(0);
    }
  });

  it('ההמלצות תמיד מפנות לאיש מקצוע ומזהירות מהחלטות על סמך המסורות', () => {
    const recs = recommendationLines(buildReport(demo(), images)).join(' ');
    expect(recs).toContain('איש מקצוע מוסמך');
    expect(recs).toContain('לא לקבל החלטות');
    expect(recs).toContain('לא התאמה מוכחת');
  });

  it('הסיכום מציין את בסיס המקרה, ושהממצאים נשענים על השאלונים בלבד', () => {
    const s = summaryLines(buildReport(demo(), images)).join(' ');
    expect(s).toMatch(/בניחוש/);
    expect(s).toContain('נשענים על השאלונים בלבד');
  });

  it('שאלונים חסרים: אין כיוון תעסוקתי, ואין ציון לתכונות', () => {
    const s = demo({ ipip: {}, riasec: {}, observations: {} });
    const r = buildReport(s, []);
    expect(interestLines(r)).toEqual([]);
    expect(personalityLines(r).every((l) => l.mean === null)).toBe(true);
    expect(strengthLines(r)).toEqual([]);
    expect(summaryLines(r).join(' ')).toContain('לא הושלם');
    expect(recommendationLines(r).join(' ')).toContain('להשלים את שאלון תחומי העניין');
  });

  it('כלים שהועברו: שני השאלונים תמיד, וכל ערוץ רק אם הועלתה בו תמונה', () => {
    const s = demo();
    const all = toolsUsed(buildReport(s, images), s).map((t) => t.name);
    expect(all.length).toBe(5);
    const onlyQ = toolsUsed(buildReport(s, []), s).map((t) => t.name);
    expect(onlyQ.length).toBe(2);
  });

  it('מהלך התהליך מציין שאף בודק לא פגש את הנבדק', () => {
    const s = demo();
    expect(processLines(buildReport(s, images), s).join(' ')).toContain('אף בודק לא פגש את הנבדק');
  });
});
