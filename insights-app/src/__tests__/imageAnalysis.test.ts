import { describe, expect, it } from 'vitest';
import {
  assessQuality,
  computeInkFeatures,
  computedObservations,
  countLines,
  laplacianVariance,
  otsuThreshold,
  type Gray,
} from '../engine/imageAnalysis';

const make = (w: number, h: number, f: (x: number, y: number) => number): Gray => {
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y);
  return { width: w, height: h, data };
};

describe('quality checks', () => {
  it('flat grey image fails contrast and sharpness', () => {
    const q = assessQuality(make(200, 200, () => 128), 1200, 1600);
    expect(q.checks.find((c) => c.id === 'contrast')!.status).toBe('fail');
    expect(q.checks.find((c) => c.id === 'sharpness')!.status).toBe('fail');
    expect(q.checks.find((c) => c.id === 'resolution')!.status).toBe('ok');
    expect(q.overall).toBe('fail');
  });
  it('dark image fails brightness', () => {
    const q = assessQuality(make(100, 100, (x) => (x % 2 ? 10 : 30)), 1000, 1000);
    expect(q.checks.find((c) => c.id === 'brightness')!.status).toBe('fail');
  });
  it('low resolution warns / fails', () => {
    const g = make(50, 50, (x, y) => ((x + y) % 2 ? 220 : 40));
    expect(assessQuality(g, 500, 700).checks[0].status).toBe('warn');
    expect(assessQuality(g, 300, 300).checks[0].status).toBe('fail');
  });
  it('sharp checkerboard is sharper than a smooth gradient', () => {
    const sharp = make(100, 100, (x, y) => (((x >> 2) + (y >> 2)) % 2 ? 230 : 30));
    const smooth = make(100, 100, (x) => 30 + x * 2);
    expect(laplacianVariance(sharp)).toBeGreaterThan(laplacianVariance(smooth) * 10);
  });
});

describe('ink features', () => {
  it('otsu separates ink from paper', () => {
    const g = make(100, 100, (x) => (x < 20 ? 30 : 240));
    const t = otsuThreshold(g);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(240);
  });
  it('small square in upper-right corner → small, right placement', () => {
    // canvas x grows to the right; centerX near 1 = right side of the page
    const g = make(400, 400, (x, y) => (x > 300 && x < 360 && y > 180 && y < 220 ? 20 : 245));
    const c = computeInkFeatures(g, false);
    expect(c.bboxAreaRatio).toBeLessThan(0.05);
    expect(c.centerX).toBeGreaterThan(0.75);
    const obs = computedObservations('drawingTree', c);
    expect(obs.find((o) => o.featureId === 'drawing.size')!.value).toBe('קטן');
    expect(obs.find((o) => o.featureId === 'drawing.placement')!.value).toBe('צד ימין');
  });
  it('large centered drawing → large, center', () => {
    const g = make(400, 400, (x, y) => ((x === 60 || x === 340 || y === 60 || y === 340) && x >= 60 && x <= 340 && y >= 60 && y <= 340 ? 10 : 245));
    const obs = computedObservations('drawingPerson', computeInkFeatures(g, false));
    expect(obs.find((o) => o.featureId === 'drawing.size')!.value).toBe('גדול');
    expect(obs.find((o) => o.featureId === 'drawing.placement')!.value).toBe('מרכז');
  });
  it('blank page has zero coverage', () => {
    expect(computeInkFeatures(make(100, 100, () => 250), true).inkCoverage).toBe(0);
  });
  it('counts text lines from projection profile', () => {
    const g = make(400, 600, (x, y) => {
      const inLine = [100, 180, 260, 340, 420].some((top) => y >= top && y < top + 30);
      return inLine && x > 40 && x < 360 && x % 3 === 0 ? 20 : 245;
    });
    const c = computeInkFeatures(g, true);
    expect(c.textLines).toBe(5);
    expect(computedObservations('handwriting', c)[0]).toMatchObject({ featureId: 'hw.lines', value: '4–8' });
  });
  it('countLines ignores tiny specks', () => {
    const rows = new Array(600).fill(0);
    rows[50] = 100; // 1-pixel speck row
    for (let y = 200; y < 230; y++) rows[y] = 100;
    expect(countLines(rows, 600)).toBe(1);
  });
});

describe('channel-aware thresholds', () => {
  it('a mostly-white page with sparse ink is fine as a page, not as a photo', () => {
    const g = make(300, 300, (x, y) => (y % 40 < 3 && x > 30 && x < 270 ? 30 : 248));
    const asPage = assessQuality(g, 1200, 1600, 'page');
    const asPhoto = assessQuality(g, 1200, 1600, 'photo');
    expect(asPage.checks.find((c) => c.id === 'brightness')!.status).toBe('ok');
    expect(asPage.checks.find((c) => c.id === 'contrast')!.status).toBe('ok');
    expect(asPhoto.checks.find((c) => c.id === 'brightness')!.status).not.toBe('ok');
  });
});
