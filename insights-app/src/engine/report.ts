// שכבות ה׳ (אינטגרציה) ו־ו׳ (בקרת איכות) + הרכבת הדוח.
// פונקציות טהורות: מקבלות סשן ומטא־דאטה של תמונות, מחזירות אובייקט דוח.
import type {
  BigFiveTrait,
  ChannelId,
  ComputedFeatures,
  IntegrationNote,
  QACheck,
  QualityReport,
  ReflectionPrompt,
  Report,
  RiasecType,
  ScaleScore,
  Session,
  TraditionNote,
} from '../types';
import {
  BIG_FIVE_NAMES,
  BIG_FIVE_ORDER,
  MINI_IPIP,
  RIASEC_ITEMS,
  RIASEC_NAMES,
  RIASEC_ORDER,
} from '../data/questionnaires';
import { CHANNELS, TRADITIONS, channelById, traditionsFor } from '../data/channels';
import { CLAIMS, SOURCES, claimById, sourceById } from '../data/evidence';
import { hollandCode, scoreScales } from './scoring';
import { PROVIDERS } from './providers';

export interface ImageMeta {
  channel: ChannelId;
  quality: QualityReport;
  computed?: ComputedFeatures;
}

/** זוגות שנבדקו במטא־אנליזה (Barrick et al., 2003). */
export const BF_RIASEC_PAIRS: [BigFiveTrait, RiasecType][] = [
  ['E', 'E'],
  ['E', 'S'],
  ['I', 'A'],
  ['I', 'I'],
  ['A', 'S'],
  ['C', 'C'],
];

const BAND_WORD = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' } as const;

export function integrate(
  bf: ScaleScore<BigFiveTrait>[],
  ri: ScaleScore<RiasecType>[],
  hasVisual: boolean,
): IntegrationNote[] {
  const notes: IntegrationNote[] = [];
  for (const [t, r] of BF_RIASEC_PAIRS) {
    const a = bf.find((s) => s.key === t)?.band;
    const b = ri.find((s) => s.key === r)?.band;
    if (!a || !b || a === 'mid' || b === 'mid') continue;
    const pair = `${BIG_FIVE_NAMES[t]} (${BAND_WORD[a]}) ו־${RIASEC_NAMES[r]} (${BAND_WORD[b]})`;
    if (a === b) {
      notes.push({
        id: `pair-${t}-${r}`,
        kind: 'consistent',
        text: `${pair}: דפוס שתואם את הכיוון שנמצא במחקר ברמת אוכלוסייה. זו התאמה בין שני שאלונים — לא אישוש חיצוני.`,
        claimId: 'integ_bf_riasec',
      });
    } else {
      notes.push({
        id: `pair-${t}-${r}`,
        kind: 'divergent',
        text: `${pair}: שילוב שונה מהכיוון הממוצע במחקר. אין כאן סתירה — הקשר באוכלוסייה מתון, ושילובים כאלה נפוצים. נקודה מעניינת להתבוננות.`,
        claimId: 'integ_bf_riasec',
      });
    }
  }
  if (notes.length === 0 && bf.every((s) => s.band) && ri.every((s) => s.band)) {
    notes.push({
      id: 'pairs-none',
      kind: 'info',
      text: 'לא נמצאו צירופים בולטים (גבוה/נמוך) בין התכונות לתחומי העניין שנבדקו במחקר.',
      claimId: 'integ_bf_riasec',
    });
  }
  if (hasVisual) {
    notes.push({
      id: 'visual-separate',
      kind: 'info',
      text: 'התצפיות החזותיות (כפות ידיים, כתב יד, ציורים) לא שימשו בחישוב אף ציון. הן מוצגות לצד השאלונים בלבד, משום שלא נמצא להן תוקף לניבוי תכונות.',
      claimId: 'drawing_signs',
    });
  }
  return notes;
}

export function reflections(bf: ScaleScore<BigFiveTrait>[], ri: ScaleScore<RiasecType>[], code: string | null) {
  const out: ReflectionPrompt[] = [];
  const known = bf.filter((s) => s.mean !== null);
  if (known.length) {
    const top = [...known].sort((a, b) => (b.mean as number) - (a.mean as number))[0];
    out.push({
      id: 'bf-top',
      text: `הציון הגבוה ביותר שלך בשאלון האישיות הוא ב״${BIG_FIVE_NAMES[top.key]}״. באילו מצבים בשבוע האחרון זה בא לידי ביטוי — ובאילו לא?`,
    });
  }
  if (code) {
    const first = code[0] as RiasecType;
    out.push({
      id: 'riasec-top',
      text: `תחום העניין הבולט שלך הוא ${RIASEC_NAMES[first]}. אילו פעילויות כאלה כבר יש בשגרה שלך, ומה היית רוצה להוסיף?`,
    });
  }
  const lowRi = ri.filter((s) => s.band === 'low');
  if (lowRi.length) {
    out.push({
      id: 'riasec-low',
      text: `דירגת נמוך את ${lowRi.map((s) => RIASEC_NAMES[s.key]).join(', ')}. האם זה משקף חוסר עניין, או מעט היכרות עם תחומים אלה?`,
    });
  }
  out.push({
    id: 'traditions',
    text: 'קראת פרשנויות מסורתיות לתמונות שלך. האם אחת מהן ״הרגישה נכונה״? שימו לב: תחושת התאמה היא תופעה מוכרת (אפקט בַּרְנוּם) ואינה ראיה לנכונות.',
  });
  return out;
}

export function runQA(report: Omit<Report, 'qa'>, session: Session): QACheck[] {
  const checks: QACheck[] = [];
  const allTraditions = report.channels.flatMap((c) => c.traditions);

  // 1. כל פרשנות מסורתית מקושרת לטענה ברמת C/D בלבד.
  const badTrad = allTraditions.filter((t) => {
    const c = claimById(t.claimId);
    return !c || c.level === 'A' || c.level === 'B';
  });
  checks.push({
    id: 'traditions-linked',
    label: 'כל פרשנות מסורתית מסומנת כלא מאומתת',
    status: badTrad.length ? 'fail' : 'ok',
    detail: badTrad.length ? `${badTrad.length} פרשנויות ללא קישור תקין` : `${allTraditions.length} פרשנויות נבדקו`,
  });

  // 2. כל טענה ברמה A–C נשענת על מקור קיים.
  const used = report.claimsUsed.map((id) => claimById(id));
  const unsourced = used.filter(
    (c) => !c || (c.level !== 'D' && (c.sourceIds.length === 0 || c.sourceIds.some((s) => !sourceById(s)))),
  );
  checks.push({
    id: 'claims-sourced',
    label: 'לכל טענה מחקרית יש מקור',
    status: unsourced.length ? 'fail' : 'ok',
    detail: unsourced.length ? 'נמצאו טענות ללא מקור' : `${used.length} טענות נבדקו`,
  });

  // 3. תצפיות תקפות — רק ערכים מתוך הרשימה הסגורה (מניעת המצאות).
  const invalid: string[] = [];
  for (const ch of report.channels) {
    const def = channelById(ch.channel);
    for (const o of ch.observations) {
      const f = def.features.find((x) => x.id === o.featureId);
      if (!f || !f.options.includes(o.value)) invalid.push(`${ch.channel}:${o.featureId}`);
    }
  }
  checks.push({
    id: 'observations-valid',
    label: 'תצפיות רק מתוך רשימה סגורה',
    status: invalid.length ? 'fail' : 'ok',
    detail: invalid.length ? `ערכים לא חוקיים: ${invalid.join(', ')}` : 'כל הערכים תקינים',
  });

  // 4. אין תצפיות "AI" כשאין ספק AI פעיל.
  const aiActive = PROVIDERS.some((p) => p.sendsDataOffDevice && p.status === 'active');
  const aiObs = report.channels.flatMap((c) => c.observations).filter((o) => o.source === 'ai');
  checks.push({
    id: 'no-phantom-ai',
    label: 'אין פלט AI מדומה',
    status: aiObs.length && !aiActive ? 'fail' : 'ok',
    detail: aiActive ? 'ספק AI פעיל' : 'אין ספק AI חיצוני פעיל — לא הוצג ניתוח AI',
  });

  // 5. ציונים מחושבים משאלונים בלבד (בדיקה מבנית: חישוב חוזר זהה).
  const reBf = scoreScales(MINI_IPIP, session.ipip, BIG_FIVE_ORDER);
  const same = JSON.stringify(reBf) === JSON.stringify(report.bigFive);
  checks.push({
    id: 'scores-from-questionnaires',
    label: 'ציוני אישיות מחושבים מהשאלון בלבד',
    status: same ? 'ok' : 'fail',
    detail: same ? 'חישוב חוזר מהתשובות זהה לדוח' : 'אי־התאמה בין התשובות לציונים',
  });

  // 6. שלמות השאלונים.
  const incomplete = [...report.bigFive, ...report.riasec].filter((s) => s.mean === null).length;
  checks.push({
    id: 'questionnaires-complete',
    label: 'שלמות השאלונים',
    status: incomplete ? 'warn' : 'ok',
    detail: incomplete ? `${incomplete} סולמות לא חושבו בגלל פריטים חסרים` : 'כל הסולמות חושבו',
  });

  // 7. איכות תמונות.
  const poor = report.channels.filter((c) => c.quality?.overall === 'fail').length;
  const missing = report.channels.filter((c) => !c.hasImage).length;
  checks.push({
    id: 'image-quality',
    label: 'איכות תמונות',
    status: poor ? 'warn' : 'ok',
    detail: `${poor} תמונות באיכות נמוכה, ${missing} ערוצים ללא תמונה`,
  });

  // 8. מקורות שממתינים לאימות ביבליוגרפי.
  const pending = new Set(
    used.flatMap((c) => c?.sourceIds ?? []).filter((s) => sourceById(s)?.verification === 'pending'),
  );
  checks.push({
    id: 'sources-verified',
    label: 'אימות ביבליוגרפי של מקורות',
    status: pending.size ? 'warn' : 'ok',
    detail: pending.size ? `${pending.size} מקורות ממתינים לאימות מול המקור המלא` : 'כל המקורות אומתו',
  });

  // 9. סימון נתוני הדגמה.
  if (report.isDemo) {
    checks.push({
      id: 'demo',
      label: 'נתוני הדגמה',
      status: 'warn',
      detail: 'הדוח מבוסס על משתמש ונתונים סינתטיים בלבד',
    });
  }
  return checks;
}

export function buildReport(session: Session, images: ImageMeta[], now = Date.now()): Report {
  const bigFive = scoreScales(MINI_IPIP, session.ipip, BIG_FIVE_ORDER);
  const riasec = scoreScales(RIASEC_ITEMS, session.riasec, RIASEC_ORDER);
  const code = hollandCode(riasec);

  const channels = CHANNELS.map((def) => {
    const img = images.find((i) => i.channel === def.id);
    const observations = session.observations[def.id] ?? [];
    const traditions: TraditionNote[] = observations.flatMap((o) => traditionsFor(def.id, o.featureId, o.value));
    return {
      channel: def.id,
      hasImage: !!img,
      quality: img?.quality,
      computed: img?.computed,
      observations,
      traditions,
    };
  });

  const hasVisual = channels.some((c) => c.hasImage);
  const integration = integrate(bigFive, riasec, hasVisual);

  const claimSet = new Set<string>(['bf_instrument', 'bf_hebrew', 'riasec_model', 'riasec_items']);
  integration.forEach((n) => claimSet.add(n.claimId));
  channels.forEach((c) => c.traditions.forEach((t) => claimSet.add(t.claimId)));
  if (channels.some((c) => c.hasImage && c.channel.startsWith('palm'))) claimSet.add('palm_lines');
  if (channels.some((c) => c.hasImage && c.channel === 'handwriting')) {
    claimSet.add('hw_personality');
    claimSet.add('hw_illusory');
  }
  if (channels.some((c) => c.hasImage && c.channel.startsWith('drawing'))) claimSet.add('drawing_signs');

  const base = {
    sessionId: session.id,
    generatedAt: now,
    isDemo: session.isDemo,
    bigFive,
    riasec,
    hollandCode: code,
    channels,
    integration,
    reflections: reflections(bigFive, riasec, code),
    claimsUsed: [...claimSet],
  };
  return { ...base, qa: runQA(base, session) };
}

// ייצוא לצורכי בדיקות עקיבות
export const _internal = { CLAIMS, SOURCES, TRADITIONS };
