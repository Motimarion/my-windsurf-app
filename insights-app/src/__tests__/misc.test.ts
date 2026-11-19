import { describe, expect, it } from 'vitest';
import { pageBreaks } from '../report/pdf';
import { href, parse, type Route } from '../router';
import { rng } from '../demo/synthetic';

describe('pdf pageBreaks', () => {
  it('prefers card boundaries', () => {
    expect(pageBreaks(2500, 1000, [400, 900, 1700, 2300])).toEqual([0, 900, 1700]);
  });
  it('hard-cuts when no candidate fits', () => {
    expect(pageBreaks(2500, 1000, [])).toEqual([0, 1000, 2000]);
  });
  it('single page', () => {
    expect(pageBreaks(800, 1000, [300])).toEqual([0]);
  });
});

describe('router', () => {
  it('round-trips', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'about' },
      { name: 'consent' },
      { name: 'hub', id: 'abc' },
      { name: 'channel', id: 'abc', channel: 'drawingTree' },
      { name: 'quest', id: 'abc', which: 'riasec' },
      { name: 'analyze', id: 'abc' },
      { name: 'report', id: 'abc' },
    ];
    for (const r of routes) expect(parse(href(r))).toEqual(r);
  });
  it('unknown channel falls back to hub', () => {
    expect(parse('#/s/x/c/evil')).toEqual({ name: 'hub', id: 'x' });
  });
});

describe('rng', () => {
  it('is deterministic', () => {
    const a = rng(5);
    const b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
