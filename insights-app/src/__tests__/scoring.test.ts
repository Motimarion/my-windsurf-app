import { describe, expect, it } from 'vitest';
import { bandOf, hollandCode, hollandTies, itemScore, progress, scoreScales } from '../engine/scoring';
import { BIG_FIVE_ORDER, MINI_IPIP, RIASEC_ITEMS, RIASEC_ORDER } from '../data/questionnaires';

describe('itemScore', () => {
  it('reverses 1..5', () => {
    expect(itemScore(1, true)).toBe(5);
    expect(itemScore(4, true)).toBe(2);
    expect(itemScore(4, false)).toBe(4);
  });
  it('rejects out-of-range values', () => {
    expect(() => itemScore(0, false)).toThrow();
    expect(() => itemScore(6, false)).toThrow();
    expect(() => itemScore(2.5, false)).toThrow();
  });
});

describe('Mini-IPIP structure', () => {
  it('has 20 items, 4 per trait, 2+ reversed per trait', () => {
    expect(MINI_IPIP).toHaveLength(20);
    for (const t of BIG_FIVE_ORDER) {
      const items = MINI_IPIP.filter((i) => i.scale === t);
      expect(items).toHaveLength(4);
      expect(items.filter((i) => i.reverse).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('RIASEC has 5 items per type and unique ids', () => {
    for (const t of RIASEC_ORDER) expect(RIASEC_ITEMS.filter((i) => i.scale === t)).toHaveLength(5);
    expect(new Set(RIASEC_ITEMS.map((i) => i.id)).size).toBe(30);
  });
});

describe('scoreScales', () => {
  it('all "5" answers: positive items max, reversed items min', () => {
    const answers = Object.fromEntries(MINI_IPIP.map((i) => [i.id, 5]));
    const s = scoreScales(MINI_IPIP, answers, BIG_FIVE_ORDER);
    // Extraversion: 2 positive (5) + 2 reversed (1) → 3
    expect(s.find((x) => x.key === 'E')!.mean).toBe(3);
    // Intellect: 1 positive + 3 reversed → (5+1+1+1)/4 = 2
    expect(s.find((x) => x.key === 'I')!.mean).toBe(2);
  });
  it('consistent high-E respondent scores 5', () => {
    const answers = Object.fromEntries(MINI_IPIP.filter((i) => i.scale === 'E').map((i) => [i.id, i.reverse ? 1 : 5]));
    const e = scoreScales(MINI_IPIP, answers, BIG_FIVE_ORDER).find((x) => x.key === 'E')!;
    expect(e.mean).toBe(5);
    expect(e.band).toBe('high');
  });
  it('missing item → null mean (no imputation)', () => {
    const answers = { ipip1: 5, ipip6: 1, ipip11: 5 };
    const e = scoreScales(MINI_IPIP, answers, BIG_FIVE_ORDER).find((x) => x.key === 'E')!;
    expect(e.mean).toBeNull();
    expect(e.answered).toBe(3);
    expect(e.band).toBeNull();
  });
  it('bands at boundaries', () => {
    expect(bandOf(2.5)).toBe('mid');
    expect(bandOf(2.49)).toBe('low');
    expect(bandOf(3.5)).toBe('mid');
    expect(bandOf(3.51)).toBe('high');
  });
});

describe('hollandCode', () => {
  it('top three, ties keep RIASEC order', () => {
    const answers = Object.fromEntries(RIASEC_ITEMS.map((i) => [i.id, ['I', 'A', 'E'].includes(i.scale) ? 4 : 2]));
    const s = scoreScales(RIASEC_ITEMS, answers, RIASEC_ORDER);
    expect(hollandCode(s)).toBe('IAE');
  });
  it('detects ties that affect the code', () => {
    const tie = Object.fromEntries(RIASEC_ITEMS.map((i) => [i.id, ['I', 'A', 'E'].includes(i.scale) ? 4 : 2]));
    expect(hollandTies(scoreScales(RIASEC_ITEMS, tie, RIASEC_ORDER))).toBe(true);
    const vals: Record<string, number> = { R: 1, I: 5, A: 4, S: 3, E: 2, C: 1 };
    const clear = Object.fromEntries(RIASEC_ITEMS.map((i) => [i.id, vals[i.scale]]));
    expect(hollandTies(scoreScales(RIASEC_ITEMS, clear, RIASEC_ORDER))).toBe(false);
  });
  it('null when incomplete', () => {
    expect(hollandCode(scoreScales(RIASEC_ITEMS, {}, RIASEC_ORDER))).toBeNull();
  });
  it('progress', () => {
    expect(progress(MINI_IPIP, { ipip1: 3 })).toEqual({ done: 1, total: 20, ratio: 0.05 });
  });
});
