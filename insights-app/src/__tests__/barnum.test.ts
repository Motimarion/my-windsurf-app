import { describe, expect, it } from 'vitest';
import { barnumReadings, barnumVerdict, ownShownFirst, traitOf } from '../engine/barnum';
import { buildReport } from '../engine/report';
import { demoAnswers, DEMO_OBSERVATIONS } from '../demo/synthetic';
import { CHANNELS, TRADITIONS } from '../data/channels';

const okQ = { width: 1000, height: 1000, brightness: 200, contrast: 50, sharpness: 100, checks: [], overall: 'ok' as const };
const images = CHANNELS.map((c) => ({ channel: c.id, quality: okQ }));
import type { Session } from '../types';

const session = (over: Partial<Session> = {}): Session => ({
  id: 'test',
  label: 't',
  isDemo: true,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ...demoAnswers(),
  observations: structuredClone(DEMO_OBSERVATIONS),
  ...over,
});

describe('Barnum check', () => {
  it('every tradition yields a short trait that hides the product description', () => {
    for (const t of TRADITIONS) {
      const trait = traitOf(t);
      expect(trait.length, t.id).toBeGreaterThan(2);
      expect(trait, t.id).not.toContain('נטען');
      expect(trait, t.id).not.toContain(t.value);
    }
  });

  it('builds two readings of equal length: same features, other values', () => {
    const r = barnumReadings(buildReport(session(), images));
    expect(r.own.length).toBeGreaterThanOrEqual(2);
    expect(r.other.length).toBe(r.own.length);
    r.own.forEach((t, i) => {
      expect(r.other[i].featureId).toBe(t.featureId);
      expect(r.other[i].channel).toBe(t.channel);
      expect(r.other[i].value).not.toBe(t.value);
    });
  });

  it('no feature or trait repeats inside the readings', () => {
    const r = barnumReadings(buildReport(session(), images));
    const traits = [...r.own, ...r.other].map(traitOf);
    expect(new Set(traits).size).toBe(traits.length);
    const feats = r.own.map((t) => `${t.channel}|${t.featureId}`);
    expect(new Set(feats).size).toBe(feats.length);
  });

  it('no observations → no readings', () => {
    const r = barnumReadings(buildReport(session({ observations: {} }), images));
    expect(r.own).toEqual([]);
    expect(r.other).toEqual([]);
  });

  it('verdict: a gap of one point counts as similar', () => {
    expect(barnumVerdict(4, 4)).toBe('similar');
    expect(barnumVerdict(5, 4)).toBe('similar');
    expect(barnumVerdict(3, 4)).toBe('similar');
    expect(barnumVerdict(5, 2)).toBe('own-higher');
    expect(barnumVerdict(1, 4)).toBe('other-higher');
  });

  it('display order is fixed per session and differs between sessions', () => {
    expect(ownShownFirst('c30678168bae4824')).toBe(true);
    expect(ownShownFirst('c30678168bae4825')).toBe(false);
  });
});
