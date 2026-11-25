// שכבה א׳ — ראייה ממוחשבת מקומית (בדפדפן, ללא שליחת התמונה לשום שירות).
// הפונקציות הטהורות עובדות על מערך גווני אפור כדי שאפשר יהיה לבדוק אותן ביחידה.
import type { ChannelId, CheckStatus, ComputedFeatures, Observation, QualityReport } from '../types';

export interface Gray {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array; // ערך אחד לכל פיקסל 0..255
}

/** ספים לבדיקות איכות. ערכים היוריסטיים — מתועדים ב־docs/ARCHITECTURE.md. */
export const QUALITY_THRESHOLDS = {
  minSideOk: 600,
  minSideWarn: 400,
  // צילום כף יד: רקע ועור — מצפים לבהירות בינונית ולניגודיות גבוהה יחסית.
  photo: { brightness: { okMin: 60, okMax: 215, warnMin: 35, warnMax: 240 }, contrastOk: 30, contrastWarn: 15 },
  // דף (כתב יד/ציור): רוב הדף לבן ומעט דיו — בהירות גבוהה וסטיית תקן נמוכה הן תקינות.
  page: { brightness: { okMin: 110, okMax: 250, warnMin: 80, warnMax: 254 }, contrastOk: 12, contrastWarn: 5 },
  sharpnessOk: 40,
  sharpnessWarn: 12,
};

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < data.length; i += 4, p++) {
    data[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return { width, height, data };
}

export function meanStd(g: Gray) {
  let sum = 0;
  let sq = 0;
  const n = g.data.length;
  for (let i = 0; i < n; i++) {
    sum += g.data[i];
    sq += g.data[i] * g.data[i];
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

/** שונות של אופרטור לפלסיאן (4-שכנים) — מדד מקובל לחדות/טשטוש. */
export function laplacianVariance(g: Gray): number {
  const { width: w, height: h, data: d } = g;
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = d[i - w] + d[i + w] + d[i - 1] + d[i + 1] - 4 * d[i];
      sum += v;
      sq += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const m = sum / n;
  return sq / n - m * m;
}

const status = (ok: boolean, warn: boolean): CheckStatus => (ok ? 'ok' : warn ? 'warn' : 'fail');

/**
 * origW/origH — מידות המקור (לבדיקת רזולוציה); g — תמונה מוקטנת לחישוב.
 * ההקטנה לפני החישוב מנרמלת את מדד החדות בין מצלמות שונות.
 */
export function assessQuality(g: Gray, origW: number, origH: number, kind: 'photo' | 'page' = 'photo'): QualityReport {
  const t = { ...QUALITY_THRESHOLDS, ...QUALITY_THRESHOLDS[kind] };
  const { mean, std } = meanStd(g);
  const sharp = laplacianVariance(g);
  const minSide = Math.min(origW, origH);
  const b = t.brightness;
  const checks: QualityReport['checks'] = [
    {
      id: 'resolution',
      label: 'רזולוציה',
      status: status(minSide >= t.minSideOk, minSide >= t.minSideWarn),
      detail: `${origW}×${origH} פיקסלים`,
    },
    {
      id: 'brightness',
      label: 'תאורה',
      status: status(mean >= b.okMin && mean <= b.okMax, mean >= b.warnMin && mean <= b.warnMax),
      detail: mean < b.okMin ? 'התמונה כהה מדי' : mean > b.okMax ? 'התמונה בהירה מדי / חשופה' : 'תאורה תקינה',
    },
    {
      id: 'contrast',
      label: 'ניגודיות',
      status: status(std >= t.contrastOk, std >= t.contrastWarn),
      detail: std < t.contrastOk ? 'ניגודיות נמוכה — פרטים עלולים לא להיראות' : 'ניגודיות תקינה',
    },
    {
      id: 'sharpness',
      label: 'חדות',
      status: status(sharp >= t.sharpnessOk, sharp >= t.sharpnessWarn),
      detail: sharp < t.sharpnessOk ? 'ייתכן טשטוש — נסו לייצב את המצלמה' : 'חדות תקינה',
    },
  ];
  const overall: CheckStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok';
  return {
    width: origW,
    height: origH,
    brightness: round1(mean),
    contrast: round1(std),
    sharpness: round1(sharp),
    checks,
    overall,
  };
}

/** סף Otsu — הפרדה אוטומטית בין "דיו" לבין "נייר". */
export function otsuThreshold(g: Gray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const total = g.data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/**
 * מאפיינים מחושבים של סימון על דף (כתב יד / ציור):
 * כיסוי דיו, מסגרת תוחמת (אחוזונים 1–99 לעמידות לרעש), מרכז כובד ומספר שורות.
 */
export function computeInkFeatures(g: Gray, withLines: boolean): ComputedFeatures {
  const { width: w, height: h, data: d } = g;
  const thr = Math.min(otsuThreshold(g), 170);
  const mx = Math.floor(w * 0.03);
  const my = Math.floor(h * 0.03);
  const xs: number[] = [];
  const ys: number[] = [];
  const rows = new Array(h).fill(0);
  let inner = 0;
  for (let y = my; y < h - my; y++) {
    for (let x = mx; x < w - mx; x++) {
      inner++;
      if (d[y * w + x] <= thr) {
        xs.push(x);
        ys.push(y);
        rows[y]++;
      }
    }
  }
  if (xs.length === 0) {
    return { inkCoverage: 0, bboxAreaRatio: 0, centerX: 0.5, centerY: 0.5, textLines: withLines ? 0 : undefined };
  }
  const pct = (arr: number[], p: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
  };
  const x0 = pct(xs, 0.01);
  const x1 = pct(xs, 0.99);
  const y0 = pct(ys, 0.01);
  const y1 = pct(ys, 0.99);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  return {
    inkCoverage: round3(xs.length / inner),
    bboxAreaRatio: round3(((x1 - x0 + 1) * (y1 - y0 + 1)) / (w * h)),
    centerX: round3(cx / w),
    centerY: round3(cy / h),
    textLines: withLines ? countLines(rows, h) : undefined,
  };
}

/** ספירת שורות לפי פרופיל הקרנה אופקי: רצפים של שורות פיקסלים "דיו". */
export function countLines(rows: number[], h: number): number {
  const max = Math.max(...rows);
  if (max === 0) return 0;
  const on = rows.map((v) => v > max * 0.12);
  const minRun = Math.max(2, Math.floor(h * 0.006));
  // פערים קטנים בתוך שורה (למשל בין גוף האות לאותיות סופיות יורדות כמו ך, ן, ק) מאוחדים.
  const maxGap = Math.max(2, Math.floor(h * 0.012));
  let lines = 0;
  let run = 0;
  let gap = 0;
  for (let y = 0; y < on.length; y++) {
    if (on[y]) {
      run += gap + 1;
      gap = 0;
    } else if (run > 0) {
      gap++;
      if (gap > maxGap) {
        if (run >= minRun) lines++;
        run = 0;
        gap = 0;
      }
    }
  }
  if (run >= minRun) lines++;
  return lines;
}

/** המרת מדידות מספריות לתצפיות קטגוריאליות — עדיין תיאור, לא פרשנות. */
export function computedObservations(channel: ChannelId, c: ComputedFeatures): Observation[] {
  const obs: Observation[] = [];
  // דף ריק (לא נמצא דיו): אין מה למדוד, ולכן אין תצפית — לא "קטן" ולא "מרכז" (אלה ערכי ברירת מחדל של מדידה ריקה).
  if (c.inkCoverage <= 0 || c.bboxAreaRatio <= 0) return obs;
  if (channel === 'drawingTree' || channel === 'drawingPerson') {
    const size = c.bboxAreaRatio < 0.15 ? 'קטן' : c.bboxAreaRatio > 0.45 ? 'גדול' : 'בינוני';
    obs.push({ featureId: 'drawing.size', value: size, source: 'computed' });
    const dx = c.centerX - 0.5;
    const dy = c.centerY - 0.5;
    let place = 'מרכז';
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 0.12) {
      if (Math.abs(dx) >= Math.abs(dy)) place = dx > 0 ? 'צד ימין' : 'צד שמאל';
      else place = dy < 0 ? 'חלק עליון' : 'חלק תחתון';
    }
    obs.push({ featureId: 'drawing.placement', value: place, source: 'computed' });
  }
  // 0 שורות אינו "1–3": נמנעים מתצפית במקום לשבץ ערך.
  if (channel === 'handwriting' && c.textLines !== undefined && c.textLines > 0) {
    const n = c.textLines;
    obs.push({ featureId: 'hw.lines', value: n <= 3 ? '1–3' : n <= 8 ? '4–8' : '9+', source: 'computed' });
  }
  return obs;
}

// ---------- עטיפה לדפדפן ----------

const MAX_ANALYSIS_SIDE = 800;

/** צד מקסימלי לעותק הנשמר. גם מקטין את נפח האחסון. */
const MAX_STORED_SIDE = 2000;

export async function analyzeBlob(blob: Blob, channel: ChannelId) {
  const bmp = await createImageBitmap(blob);
  // שמירת עותק מקודד מחדש: ציור על canvas מסיר את כל מטא־הנתונים (EXIF — מיקום GPS, דגם מכשיר, זמן).
  const ss = Math.min(1, MAX_STORED_SIDE / Math.max(bmp.width, bmp.height));
  const sc = document.createElement('canvas');
  sc.width = Math.max(1, Math.round(bmp.width * ss));
  sc.height = Math.max(1, Math.round(bmp.height * ss));
  sc.getContext('2d')!.drawImage(bmp, 0, 0, sc.width, sc.height);
  const clean = await new Promise<Blob>((res, rej) =>
    sc.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.9),
  );
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const gray = toGray(ctx.getImageData(0, 0, w, h).data, w, h);
  const isPage = channel === 'handwriting' || channel.startsWith('drawing');
  const quality = assessQuality(gray, bmp.width, bmp.height, isPage ? 'page' : 'photo');
  const computed = isPage ? computeInkFeatures(gray, channel === 'handwriting') : undefined;
  bmp.close();
  return { quality, computed, clean };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
