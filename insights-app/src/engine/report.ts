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
import { hollandCode, hollandTies, scoreScales } from './scoring';
import { PROVIDERS } from './providers';
import { synthesize } from './synthesis';

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

export type VisualKind = 'palm' | 'handwriting' | 'drawing';

const VISUAL_NOTE: Record<VisualKind, { claimId: string; text: string }> = {
  palm: { claimId: 'palm_lines', text: 'קווי כף היד: לא אותר מחקר מבוקר על קשר לאישיות — לא נחקר, ולכן גם לא הוכח.' },
  handwriting: { claimId: 'hw_personality', text: 'כתב היד: נחקר — והמחקר לא מצא תוקף להסקת אישיות כשתוכן הטקסט מנוטרל.' },
  drawing: { claimId: 'drawing_signs', text: 'הציורים: נחקרו — ולרוב ״הסימנים״ לא נמצא תוקף משוכפל.' },
};

export function integrate(
  bf: ScaleScore<BigFiveTrait>[],
  ri: ScaleScore<RiasecType>[],
  visualKinds: VisualKind[],
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
  for (const k of visualKinds) {
    notes.push({
      id: `visual-separate-${k}`,
      kind: 'info',
      text: `${VISUAL_NOTE[k].text} התצפיות לא שימשו בחישוב אף ציון ומוצגות לצד השאלונים בלבד.`,
      claimId: VISUAL_NOTE[k].claimId,
    });
  }
  return notes;
}

export function reflections(
  bf: ScaleScore<BigFiveTrait>[],
  ri: ScaleScore<RiasecType>[],
  code: string | null,
  hasTraditions: boolean,
) {
  const out: ReflectionPrompt[] = [];
  // לא משווים ממוצעים גולמיים בין תכונות שונות (אין נורמות) — מתייחסים לכל תכונה בתוך הסולם שלה בלבד.
  const extreme = bf.find((s) => s.band === 'high' || s.band === 'low');
  if (extreme) {
    out.push({
      id: 'bf-extreme',
      text: `ב״${BIG_FIVE_NAMES[extreme.key]}״ התשובות שלך נוטות לקצה ה${extreme.band === 'high' ? 'גבוה' : 'נמוך'} של הסולם. באילו מצבים בשבוע האחרון זה בא לידי ביטוי — ובאילו לא?`,
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
  if (hasTraditions) {
    out.push({
      id: 'traditions',
      text: 'קראת פרשנויות מסורתיות לתמונות שלך. האם אחת מהן ״הרגישה נכונה״? שימו לב: תחושת התאמה היא תופעה מוכרת (אפקט בַּרְנוּם) ואינה ראיה לנכונות.',
    });
  }
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
    detail: badTrad.length
      ? `${badTrad.length} פרשנויות מקושרות לטענה חסרה או לטענה ברמת A/B`
      : `${allTraditions.length} פרשנויות נבדקו`,
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

  // 4. אין פלט AI מדומה: כל ערך AI חייב להגיע מהרצה מתועדת של תחנת המנוע (גשר ידני או שליחה אוטומטית),
  //    שעברה בשער הרשימה הסגורה ושהמשתמש אימץ, דרך ספק פעיל. ערך AI בלי הרצה כזו — כישלון.
  const providerActive = (id: string) => PROVIDERS.some((p) => p.id === id && p.status === 'active');
  const runs = session.aiRuns ?? [];
  const documented = (ch: string) =>
    runs.some((r) => r.channel === ch && r.adopted && providerActive(r.mode === 'auto' ? 'gemini-api' : 'manual-bridge'));
  const aiByChannel = report.channels
    .map((c) => ({ ch: c.channel, n: c.observations.filter((o) => o.source === 'ai').length }))
    .filter((x) => x.n > 0);
  const orphan = aiByChannel.filter((x) => !documented(x.ch));
  const aiCount = aiByChannel.reduce((a, x) => a + x.n, 0);
  checks.push({
    id: 'no-phantom-ai',
    label: 'אין פלט AI מדומה',
    status: orphan.length ? 'fail' : 'ok',
    detail: orphan.length
      ? `ערכי AI בלי הרצה מתועדת: ${orphan.map((x) => x.ch).join(', ')}`
      : aiCount
        ? `${aiCount} ערכי AI — כולם עברו בשער הרשימה הסגורה ותועדו`
        : 'אין ערכי AI בדוח',
  });

  // 5. עקביות: הציונים בדוח תואמים חישוב חוזר מהתשובות השמורות (מגן מפני דוח ישן או ציונים שנערכו).
  //    ההפרדה המבנית מתמונות נבדקת בבדיקת יחידה ייעודית (ציונים זהים עם תמונות ובלעדיהן).
  const same =
    JSON.stringify(scoreScales(MINI_IPIP, session.ipip, BIG_FIVE_ORDER)) === JSON.stringify(report.bigFive) &&
    JSON.stringify(scoreScales(RIASEC_ITEMS, session.riasec, RIASEC_ORDER)) === JSON.stringify(report.riasec);
  checks.push({
    id: 'scores-from-questionnaires',
    label: 'הציונים תואמים את התשובות השמורות',
    status: same ? 'ok' : 'fail',
    detail: same ? 'חישוב חוזר של שני השאלונים זהה לדוח' : 'אי־התאמה בין התשובות לציונים',
  });

  // 5ב. טענה ברמת A חייבת לפחות מקור אחד שאומת.
  const weakA = used.filter((c) => c?.level === 'A' && !c.sourceIds.some((s) => sourceById(s)?.verification === 'verified-db'));
  checks.push({
    id: 'level-a-verified',
    label: 'טענות ברמה A נשענות על מקור מאומת',
    status: weakA.length ? 'fail' : 'ok',
    detail: weakA.length ? `ללא מקור מאומת: ${weakA.map((c) => c!.id).join(', ')}` : 'תקין',
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

  const kinds = new Set<VisualKind>();
  channels.filter((c) => c.hasImage).forEach((c) => kinds.add(channelById(c.channel).kind));
  const integration = integrate(bigFive, riasec, [...kinds]);
  const hasTraditions = channels.some((c) => c.traditions.length > 0);

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
    hollandTie: hollandTies(riasec),
    channels,
    integration,
    synthesis: synthesize(bigFive, riasec, channels, session),
    reflections: reflections(bigFive, riasec, code, hasTraditions),
    claimsUsed: [...claimSet],
  };
  return { ...base, qa: runQA(base, session) };
}

// ייצוא לצורכי בדיקות עקיבות
export const _internal = { CLAIMS, SOURCES, TRADITIONS };
