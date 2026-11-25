// נתוני הדגמה סינתטיים: משתמש בדוי, תמונות שנוצרות בקוד, ותשובות לפי זרע קבוע.
// אין כאן שום מידע אישי ואין תלות במפתחות API.
import type { Background, ChannelId, LikertAnswers, Observation, Session } from '../types';
import { MINI_IPIP, RIASEC_ITEMS } from '../data/questionnaires';
import { CONSENT_ITEMS, CONSENT_VERSION } from '../data/consent';

/** מחולל פסאודו־אקראי דטרמיניסטי (mulberry32) — כדי שההדגמה תהיה ניתנת לשחזור. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** פרופיל יעד לכל סולם (1..5); התשובות נגזרות ממנו עם רעש קטן. */
const BF_PROFILE: Record<string, number> = { E: 4.2, A: 3.9, C: 2.6, N: 2.2, I: 4.4 };
const RI_PROFILE: Record<string, number> = { R: 2.0, I: 4.3, A: 4.1, S: 3.2, E: 3.7, C: 1.8 };

function answersFor(
  items: { id: string; scale: string; reverse: boolean }[],
  profile: Record<string, number>,
  rand: () => number,
): LikertAnswers {
  const out: LikertAnswers = {};
  for (const it of items) {
    const target = profile[it.scale] + (rand() - 0.5) * 1.2;
    const v = Math.min(5, Math.max(1, Math.round(target)));
    out[it.id] = it.reverse ? 6 - v : v;
  }
  return out;
}

export function demoAnswers(seed = 7) {
  const r = rng(seed);
  return { ipip: answersFor(MINI_IPIP, BF_PROFILE, r), riasec: answersFor(RIASEC_ITEMS, RI_PROFILE, r) };
}

const demoObs = (pairs: [string, string][]): Observation[] =>
  pairs.map(([featureId, value]) =>
    // "לא ניתן לקבוע" בהדגמה תמיד מגיע עם סיבת חסימה, כמו בסימון אמיתי
    value === 'לא ניתן לקבוע' ? { featureId, value, source: 'demo', blockedBy: 'הסתרה' } : { featureId, value, source: 'demo' },
  );

export const DEMO_OBSERVATIONS: Partial<Record<ChannelId, Observation[]>> = {
  palmRight: demoObs([
    ['palm.lineClarity', 'ברורים'],
    ['palm.heartLineEnd', 'בין המורה לאמה'],
    ['palm.headLineShape', 'מעוקל'],
    ['palm.lifeLineArc', 'רחבה'],
  ]),
  palmLeft: demoObs([
    ['palm.lineClarity', 'בינוניים'],
    ['palm.heartLineEnd', 'מתחת לאמה'],
    ['palm.headLineShape', 'ישר'],
    ['palm.lifeLineArc', 'לא ניתן לקבוע'],
  ]),
  handwriting: demoObs([
    ['hw.slant', 'קדימה (בכיוון הכתיבה)'],
    ['hw.size', 'בינוני'],
    ['hw.spacing', 'מרווח'],
    ['hw.baseline', 'ישר'],
  ]),
  drawingTree: demoObs([
    ['tree.roots', 'מצוירים'],
    ['tree.crown', 'מעוגלת / ענן'],
    ['tree.trunk', 'בינוני'],
    ['tree.fruit', 'מצוירים'],
    ['tree.ground', 'מצויר'],
  ]),
  drawingPerson: demoObs([
    ['person.completeness', 'דמות מלאה'],
    ['person.style', 'סכמטי (קווים)'],
    ['person.face', 'חלקיים'],
    ['person.hands', 'גלויות'],
  ]),
};

export const DEMO_BACKGROUND: Background = {
  dominantHand: 'ימין',
  writingHand: 'ימין',
  handwritingSource: 'הועתק מטקסט',
  treeMinutes: '2–5 דקות',
  personMinutes: 'עד 2 דקות',
  drawingExperience: 'כמעט אין',
};

export function demoSession(id: string): Session {
  const now = Date.now();
  const { ipip, riasec } = demoAnswers();
  return {
    id,
    label: 'משתמש/ת הדגמה (סינתטי)',
    isDemo: true,
    createdAt: now,
    updatedAt: now,
    consent: { version: CONSENT_VERSION, acceptedAt: now, items: CONSENT_ITEMS.map((c) => c.id) },
    ipip,
    riasec,
    observations: structuredClone(DEMO_OBSERVATIONS),
    // שאלות רקע סינתטיות. מוצגות כהקשר בלבד ולא משנות דבר בחישוב.
    background: { ...DEMO_BACKGROUND },
  };
}

// ---------- תמונות סינתטיות (Canvas) ----------

const W = 900;
const H = 1200;

function page(bg = '#fbfaf6') {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // רעש עדין של נייר כדי שבדיקות האיכות יעבדו על משהו מציאותי יותר
  const r = rng(3);
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    ctx.fillRect(r() * W, r() * H, 1.5, 1.5);
  }
  return { c, ctx };
}

function drawPalm(mirror: boolean) {
  const { c, ctx } = page('#e9edf0');
  ctx.save();
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.fillStyle = '#e2b593';
  ctx.strokeStyle = '#9a6b4f';
  ctx.lineWidth = 4;
  // כף היד
  ctx.beginPath();
  ctx.ellipse(450, 760, 230, 290, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // אצבעות
  const fingers = [
    [290, 420, 48, 170],
    [390, 360, 50, 210],
    [500, 350, 50, 220],
    [600, 400, 46, 190],
  ];
  for (const [x, y, rx, ry] of fingers) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // אגודל
  ctx.beginPath();
  ctx.ellipse(700, 760, 60, 170, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // קווים
  ctx.strokeStyle = '#6f4330';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(250, 600);
  ctx.quadraticCurveTo(420, 560, 560, 590);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(260, 700);
  ctx.quadraticCurveTo(420, 690, 600, 760);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(620, 640);
  ctx.quadraticCurveTo(470, 800, 560, 1010);
  ctx.stroke();
  ctx.restore();
  return c;
}

function drawHandwriting() {
  const { c, ctx } = page();
  const lines = [
    'בבוקר אני יוצא מהבית ופונה ימינה',
    'לאורך הרחוב הראשי עד לכיכר הגדולה.',
    'משם ממשיכים ברגל כעשר דקות',
    'עוברים ליד הספרייה ובית הקפה',
    'וחוצים את הגשר הקטן מעל הנחל.',
    'המשרד נמצא בבניין האבן בקומה השלישית.',
  ];
  ctx.fillStyle = '#1d2b6b';
  ctx.font = 'italic 46px "Segoe Script", "Comic Sans MS", cursive, sans-serif';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  lines.forEach((t, i) => {
    ctx.save();
    ctx.translate(820, 200 + i * 120);
    ctx.rotate(-0.012 * (i % 2));
    ctx.fillText(t, 0, 0);
    ctx.restore();
  });
  return c;
}

function drawTree() {
  const { c, ctx } = page();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // גזע
  ctx.beginPath();
  ctx.moveTo(420, 880);
  ctx.lineTo(430, 560);
  ctx.moveTo(500, 880);
  ctx.lineTo(490, 560);
  ctx.stroke();
  // שורשים וקו קרקע
  ctx.beginPath();
  ctx.moveTo(420, 880);
  ctx.quadraticCurveTo(380, 930, 340, 950);
  ctx.moveTo(500, 880);
  ctx.quadraticCurveTo(540, 930, 590, 950);
  ctx.moveTo(460, 880);
  ctx.lineTo(462, 960);
  ctx.moveTo(220, 900);
  ctx.lineTo(700, 900);
  ctx.stroke();
  // צמרת
  ctx.beginPath();
  const cx = 460;
  const cy = 430;
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) {
    const r = 210 + 25 * Math.sin(a * 5);
    const x = cx + r * Math.cos(a);
    const y = cy + r * 0.8 * Math.sin(a);
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // פירות
  ctx.fillStyle = '#2b2b2b';
  [
    [380, 400],
    [520, 360],
    [470, 500],
    [560, 470],
    [350, 500],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
  });
  return c;
}

function drawPerson() {
  const { c, ctx } = page();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(450, 330, 80, 0, Math.PI * 2); // ראש
  ctx.moveTo(420, 315);
  ctx.arc(420, 315, 6, 0, Math.PI * 2); // עין
  ctx.moveTo(486, 315);
  ctx.arc(480, 315, 6, 0, Math.PI * 2);
  ctx.moveTo(420, 360);
  ctx.quadraticCurveTo(450, 385, 480, 360); // פה
  ctx.moveTo(450, 410);
  ctx.lineTo(450, 720); // גוף
  ctx.moveTo(450, 480);
  ctx.lineTo(320, 600); // ידיים
  ctx.moveTo(450, 480);
  ctx.lineTo(580, 600);
  ctx.moveTo(450, 720);
  ctx.lineTo(360, 930); // רגליים
  ctx.moveTo(450, 720);
  ctx.lineTo(540, 930);
  ctx.stroke();
  return c;
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.9));

/** דוגמה סינתטית לערוץ אחד, להצגה ליד הוראות הצילום. כל ערוץ מקבל ציור משלו (עץ ואדם בנפרד). */
export function demoSampleDataUrl(channel: ChannelId): string {
  const draw: Record<ChannelId, () => HTMLCanvasElement> = {
    palmRight: () => drawPalm(false),
    palmLeft: () => drawPalm(true),
    handwriting: drawHandwriting,
    drawingTree: drawTree,
    drawingPerson: drawPerson,
  };
  return draw[channel]().toDataURL('image/jpeg', 0.7);
}

export async function demoImages(): Promise<{ channel: ChannelId; blob: Blob }[]> {
  return Promise.all([
    toBlob(drawPalm(false)).then((blob) => ({ channel: 'palmRight' as const, blob })),
    toBlob(drawPalm(true)).then((blob) => ({ channel: 'palmLeft' as const, blob })),
    toBlob(drawHandwriting()).then((blob) => ({ channel: 'handwriting' as const, blob })),
    toBlob(drawTree()).then((blob) => ({ channel: 'drawingTree' as const, blob })),
    toBlob(drawPerson()).then((blob) => ({ channel: 'drawingPerson' as const, blob })),
  ]);
}
