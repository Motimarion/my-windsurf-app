import { describe, expect, it } from 'vitest';
import { buildReport, integrate } from '../engine/report';
import { demoAnswers, DEMO_OBSERVATIONS } from '../demo/synthetic';
import { CHANNELS, TRADITIONS, isAllowedValue, UNDETERMINED } from '../data/channels';
import { CLAIMS, SOURCES, claimById } from '../data/evidence';
import { BIG_FIVE_ORDER, MINI_IPIP, RIASEC_ITEMS, RIASEC_ORDER } from '../data/questionnaires';
import { scoreScales } from '../engine/scoring';
import type { Session } from '../types';

const baseSession = (over: Partial<Session> = {}): Session => ({
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

const okQuality = { width: 1000, height: 1000, brightness: 200, contrast: 50, sharpness: 100, checks: [], overall: 'ok' as const };
const allImages = CHANNELS.map((c) => ({ channel: c.id, quality: okQuality }));

describe('data integrity (layer B/C traceability)', () => {
  it('every claim source exists; A–C claims have sources', () => {
    for (const c of CLAIMS) {
      for (const s of c.sourceIds) expect(SOURCES.some((x) => x.id === s), `${c.id}→${s}`).toBe(true);
      if (c.level !== 'D') expect(c.sourceIds.length, c.id).toBeGreaterThan(0);
    }
  });
  it('every tradition maps to an existing feature option and a C/D claim', () => {
    for (const t of TRADITIONS) {
      const chans = t.channel === 'palm' ? CHANNELS.filter((c) => c.kind === 'palm') : CHANNELS.filter((c) => c.id === t.channel);
      expect(chans.length, t.id).toBeGreaterThan(0);
      for (const ch of chans) {
        const f = ch.features.find((x) => x.id === t.featureId);
        expect(f, `${t.id} feature`).toBeDefined();
        expect(f!.options, `${t.id} option`).toContain(t.value);
      }
      expect(['C', 'D']).toContain(claimById(t.claimId)!.level);
      expect(t.text.includes('נטען')).toBe(true);
    }
  });
  it('demo observations use only valid options', () => {
    for (const [ch, obs] of Object.entries(DEMO_OBSERVATIONS)) {
      const def = CHANNELS.find((c) => c.id === ch)!;
      // ערך מהרשימה הסגורה, או "לא ניתן לקבוע" עם סיבת חסימה
      for (const o of obs!) {
        const f = def.features.find((x) => x.id === o.featureId)!;
        expect(isAllowedValue(f, o.value), `${ch}:${o.featureId}=${o.value}`).toBe(true);
        if (o.value === UNDETERMINED) expect(o.blockedBy).toBeTruthy();
      }
    }
  });
});

describe('buildReport', () => {
  it('demo report passes QA with no failures', () => {
    const r = buildReport(baseSession(), allImages, 1);
    expect(r.qa.filter((q) => q.status === 'fail')).toEqual([]);
    expect(r.hollandCode).toHaveLength(3);
    expect(r.bigFive.every((s) => s.mean !== null)).toBe(true);
    expect(r.channels.flatMap((c) => c.traditions).length).toBeGreaterThan(0);
    expect(r.qa.find((q) => q.id === 'demo')!.status).toBe('warn');
  });
  it('scores are identical with or without images (images never feed scores)', () => {
    const a = buildReport(baseSession(), allImages, 1);
    const b = buildReport(baseSession({ observations: {} }), [], 1);
    expect(a.bigFive).toEqual(b.bigFive);
    expect(a.riasec).toEqual(b.riasec);
  });
  it('QA fails on an invented observation value', () => {
    const s = baseSession({ observations: { handwriting: [{ featureId: 'hw.size', value: 'ענק', source: 'manual' }] } });
    expect(buildReport(s, allImages).qa.find((q) => q.id === 'observations-valid')!.status).toBe('fail');
  });
  it('QA fails on AI observations when no AI provider is active', () => {
    const s = baseSession({ observations: { handwriting: [{ featureId: 'hw.size', value: 'גדול', source: 'ai' }] } });
    expect(buildReport(s, allImages).qa.find((q) => q.id === 'no-phantom-ai')!.status).toBe('fail');
  });
  it('incomplete questionnaires produce a warning, not a crash', () => {
    const r = buildReport(baseSession({ ipip: {}, riasec: {} }), []);
    expect(r.qa.find((q) => q.id === 'questionnaires-complete')!.status).toBe('warn');
    expect(r.hollandCode).toBeNull();
  });
  it('palm-only session does not cite drawing research', () => {
    const palmOnly = [{ channel: 'palmLeft' as const, quality: okQuality }];
    const r = buildReport(baseSession({ observations: { palmLeft: DEMO_OBSERVATIONS.palmLeft } }), palmOnly);
    expect(r.claimsUsed).toContain('palm_lines');
    expect(r.claimsUsed).not.toContain('drawing_signs');
  });
  it('traditions reflection prompt only appears when traditions exist', () => {
    expect(buildReport(baseSession({ observations: {} }), []).reflections.some((x) => x.id === 'traditions')).toBe(false);
    expect(buildReport(baseSession(), allImages).reflections.some((x) => x.id === 'traditions')).toBe(true);
  });
  it('every level-A claim has at least one verified source', () => {
    for (const c of CLAIMS.filter((x) => x.level === 'A'))
      expect(c.sourceIds.some((s) => SOURCES.find((x) => x.id === s)!.verification === 'verified-db'), c.id).toBe(true);
  });
  it('palm/handwriting/drawing claims are attached only when images exist', () => {
    const r = buildReport(baseSession({ observations: {} }), []);
    expect(r.claimsUsed).not.toContain('hw_personality');
    const r2 = buildReport(baseSession(), allImages);
    expect(r2.claimsUsed).toEqual(expect.arrayContaining(['hw_personality', 'palm_lines', 'drawing_signs']));
  });
});

describe('integrate', () => {
  const answersFor = (bf: Record<string, 1 | 5>, ri: Record<string, 1 | 5>) => ({
    bf: scoreScales(MINI_IPIP, Object.fromEntries(MINI_IPIP.map((i) => { const v = bf[i.scale] ?? 3; return [i.id, i.reverse ? 6 - v : v]; })), BIG_FIVE_ORDER),
    ri: scoreScales(RIASEC_ITEMS, Object.fromEntries(RIASEC_ITEMS.map((i) => [i.id, ri[i.scale] ?? 3])), RIASEC_ORDER),
  });
  it('high E + high Enterprising → consistent', () => {
    const { bf, ri } = answersFor({ E: 5 }, { E: 5 });
    expect(integrate(bf, ri, []).find((n) => n.id === 'pair-E-E')!.kind).toBe('consistent');
  });
  it('high Openness + low Artistic → divergent, never "contradiction"', () => {
    const { bf, ri } = answersFor({ I: 5 }, { A: 1 });
    const n = integrate(bf, ri, []).find((x) => x.id === 'pair-I-A')!;
    expect(n.kind).toBe('divergent');
    expect(n.text).toContain('אין כאן סתירה');
  });
  it('adds a per-channel visual note citing the matching claim', () => {
    const { bf, ri } = answersFor({}, {});
    const notes = integrate(bf, ri, ['palm']);
    const v = notes.find((n) => n.id === 'visual-separate-palm')!;
    expect(v.claimId).toBe('palm_lines');
    expect(notes.some((n) => n.claimId === 'drawing_signs')).toBe(false);
  });
});
