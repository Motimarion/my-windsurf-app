import { describe, expect, it } from 'vitest';
import { chanceAtLeast, synthesize } from '../engine/synthesis';
import { buildReport } from '../engine/report';
import { THEMES, TRADITION_THEME } from '../data/themes';
import { CHANNELS, TRADITIONS } from '../data/channels';
import { BIG_FIVE_ORDER, RIASEC_ORDER } from '../data/questionnaires';
import { demoAnswers, DEMO_OBSERVATIONS } from '../demo/synthetic';
import type { BigFiveTrait, ChannelId, RiasecType, ScaleScore, Session, TraditionNote } from '../types';

type Band = ScaleScore<string>['band'];
const bf = (bands: Partial<Record<BigFiveTrait, Band>> = {}): ScaleScore<BigFiveTrait>[] =>
  BIG_FIVE_ORDER.map((key) => {
    const band = bands[key] === undefined ? 'mid' : bands[key]!;
    return { key, band, mean: band === null ? null : band === 'high' ? 4.5 : band === 'low' ? 1.5 : 3, answered: 4, total: 4 };
  });
const ri = (): ScaleScore<RiasecType>[] => RIASEC_ORDER.map((key) => ({ key, band: 'mid', mean: 3, answered: 5, total: 5 }));

const note = (channel: ChannelId, id: string): TraditionNote => {
  const t = TRADITIONS.find((x) => x.id === id && (x.channel === channel || (x.channel === 'palm' && channel.startsWith('palm'))));
  if (!t) throw new Error(`no tradition ${id} for ${channel}`);
  return t;
};
const session = (over: Partial<Session> = {}): Session => ({
  id: 's',
  label: '',
  isDemo: false,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ipip: {},
  riasec: {},
  observations: {},
  ...over,
});
const theme = (s: ReturnType<typeof synthesize>, id: string) => s.themes.find((t) => t.id === id)!;

describe('מיפוי המסורות לנושאים', () => {
  it('לכל טענה מסורתית יש נושא וכיוון, ואין שורות מיותרות', () => {
    for (const t of TRADITIONS) expect(TRADITION_THEME[t.id], t.id).toBeDefined();
    const ids = new Set(TRADITIONS.map((t) => t.id));
    for (const k of Object.keys(TRADITION_THEME)) expect(ids.has(k), k).toBe(true);
  });

  it('נושא "אחר" בלי כיוון; נושא עם עוגן תמיד עם כיוון', () => {
    for (const [id, m] of Object.entries(TRADITION_THEME)) {
      if (m.theme === 'other') expect(m.dir, id).toBe(0);
      else expect([1, -1], id).toContain(m.dir);
    }
  });

  it('לכל נושא עם עוגן יש תכונת Big Five אחרת', () => {
    const traits = THEMES.filter((t) => t.trait).map((t) => t.trait);
    expect(new Set(traits).size).toBe(BIG_FIVE_ORDER.length);
  });
});

describe('השוואה לשאלון', () => {
  it('אותו כיוון → תואם; כיוון הפוך → הפוך; שאלון באמצע → ניטרלי; בלי ציון → אין השוואה', () => {
    const ch = [{ channel: 'handwriting' as const, traditions: [note('handwriting', 'hw.slant=קדימה (בכיוון הכתיבה)'), note('handwriting', 'hw.spacing=מרווח')] }];
    const high = theme(synthesize(bf({ E: 'high' }), ri(), ch, session()), 'extraversion');
    expect(high.entries.map((e) => e.vs)).toEqual(['match', 'mismatch']);
    expect(high.agreement).toBe('mixed');
    expect(theme(synthesize(bf({ E: 'mid' }), ri(), ch, session()), 'extraversion').entries.map((e) => e.vs)).toEqual(['neutral', 'neutral']);
    expect(theme(synthesize(bf({ E: null }), ri(), ch, session()), 'extraversion').entries.map((e) => e.vs)).toEqual(['na', 'na']);
  });

  it('נוירוטיות גבוהה = יציבות נמוכה (היפוך הכיוון)', () => {
    const ch = [{ channel: 'drawingTree' as const, traditions: [note('drawingTree', 'tree.trunk=דק'), note('drawingTree', 'tree.trunk=עבה')] }];
    const t = theme(synthesize(bf({ N: 'high' }), ri(), ch, session()), 'stability');
    expect(t.dir).toBe(-1);
    expect(t.entries.map((e) => e.vs)).toEqual(['match', 'mismatch']);
  });

  it('אגרגציה מכל הערוצים: כף יד, כתב וציורים נפגשים באותו נושא', () => {
    const ch = [
      { channel: 'palmRight' as const, traditions: [note('palmRight', 'palm.lifeLineArc=רחבה')] },
      { channel: 'handwriting' as const, traditions: [note('handwriting', 'hw.size=גדול')] },
      { channel: 'drawingTree' as const, traditions: [note('drawingTree', 'tree.crown=ענפים פתוחים'), note('drawingTree', 'drawing.placement=צד ימין')] },
    ];
    const s = synthesize(bf({ E: 'low' }), ri(), ch, session());
    const e = theme(s, 'extraversion');
    expect(e.entries.map((x) => x.channel)).toEqual(['palmRight', 'handwriting', 'drawingTree']);
    expect(e.agreement).toBe('same');
    expect(e.entries.every((x) => x.vs === 'mismatch')).toBe(true);
    expect(s).toMatchObject({ total: 4, compared: 3, matched: 0, neutral: 0, unanchored: 1 });
  });

  it('מסמן מי תיאר את המאפיין: מודל AI עם שם המודל', () => {
    const ch = [{ channel: 'handwriting' as const, traditions: [note('handwriting', 'hw.size=גדול')] }];
    const s = synthesize(bf({ E: 'high' }), ri(), ch, session({ observations: { handwriting: [{ featureId: 'hw.size', value: 'גדול', source: 'ai', model: 'Gemini' }] } }));
    expect(theme(s, 'extraversion').entries[0]).toMatchObject({ source: 'ai', model: 'Gemini' });
  });

  it('נושא בלי טענות מסורתיות מסומן "none", ותחומי העניין הקשורים מוצגים', () => {
    const s = synthesize(bf(), ri(), [], session());
    expect(s.total).toBe(0);
    expect(theme(s, 'warmth').agreement).toBe('none');
    expect(theme(s, 'imagination').riasec.map((r) => r.key)).toEqual(['A', 'I']);
  });
});

describe('השילוב בתוך הדוח', () => {
  const okQuality = { width: 1000, height: 1000, brightness: 200, contrast: 50, sharpness: 100, checks: [], overall: 'ok' as const };
  const images = CHANNELS.map((c) => ({ channel: c.id, quality: okQuality }));
  const demo = (withObs: boolean): Session => ({
    ...session({ isDemo: true }),
    ...demoAnswers(),
    observations: withObs ? structuredClone(DEMO_OBSERVATIONS) : {},
  });

  it('הדוח כולל את שלב השילוב, והשילוב לא משנה אף ציון', () => {
    const withObs = buildReport(demo(true), images);
    const without = buildReport(demo(false), images);
    expect(withObs.synthesis.total).toBeGreaterThan(0);
    expect(without.synthesis.total).toBe(0);
    expect(withObs.bigFive).toEqual(without.bigFive);
    expect(withObs.riasec).toEqual(without.riasec);
  });

  it('כל טענה בשילוב היא טענה מסורתית שמופיעה גם בערוץ שלה בדוח', () => {
    const r = buildReport(demo(true), images);
    for (const t of r.synthesis.themes) {
      for (const e of t.entries) {
        const ch = r.channels.find((c) => c.channel === e.channel)!;
        expect(ch.traditions.some((x) => x.id === e.note.id)).toBe(true);
      }
    }
    const perChannel = r.channels.reduce((a, c) => a + c.traditions.length, 0);
    expect(r.synthesis.total).toBe(perChannel);
  });
});

describe('סיכוי להתאמה בניחוש', () => {
  it('מחשב התפלגות בינומית עם p=0.5', () => {
    expect(chanceAtLeast(4, 5)).toBeCloseTo(6 / 32);
    expect(chanceAtLeast(0, 7)).toBe(1);
    expect(chanceAtLeast(3, 3)).toBeCloseTo(1 / 8);
    expect(chanceAtLeast(0, 0)).toBe(1);
  });
});
