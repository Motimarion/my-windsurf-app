import { describe, expect, it } from 'vitest';
import { CLAIMS, LEVELS, LEVEL_LABELS, LEVEL_MEANING, levelExamples } from '../data/evidence';
import { EDITION_LABEL, FOOTER_NOTE, IS_CONSUMER, PAGE_DISCLAIMER } from '../edition';

describe('evidence-level legend', () => {
  it('every level has a label and a plain-language meaning for the reader', () => {
    for (const l of LEVELS) {
      expect(LEVEL_LABELS[l].long.length).toBeGreaterThan(10);
      expect(LEVEL_MEANING[l].length).toBeGreaterThan(15);
    }
  });

  it('the example for each level is the first claim at that level', () => {
    const ex = levelExamples(CLAIMS);
    for (const l of LEVELS) {
      expect(ex[l]?.id).toBe(CLAIMS.find((c) => c.level === l)?.id);
    }
  });

  it('a level with no claim in the report gets no example', () => {
    const ex = levelExamples(CLAIMS.filter((c) => c.level === 'D'));
    expect(ex.A).toBeUndefined();
    expect(ex.D).toBeDefined();
  });
});

describe('"not a diagnosis" wording by edition', () => {
  it('course edition: research and demo, not a diagnosis', () => {
    expect(IS_CONSUMER).toBe(false);
    expect(EDITION_LABEL).toContain('לא אבחון');
    expect(PAGE_DISCLAIMER).toContain('אינו אבחון');
    expect(FOOTER_NOTE).toContain('במכשיר זה');
  });
});
