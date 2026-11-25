// ניסוח הדוח במבנה של דוח אבחון: כלים, מהלך, ממצאים, סיכום, חוזקות והמלצות.
// פונקציות טהורות. כל משפט נגזר מציון בשאלון, מתצפית מרשימה סגורה או מתוצאת שלב השילוב.
import type { BigFiveTrait, ChannelId, Report, RiasecType, Session } from '../types';
import { BF_BAND_TEXT, BF_STRENGTH, RIASEC_TEXT } from '../data/reportText';
import { BIG_FIVE_NAMES, MINI_IPIP, RIASEC_ITEMS, RIASEC_NAMES } from '../data/questionnaires';
import { channelById } from '../data/channels';
import { chanceAtLeast } from './synthesis';

const answered = (items: { id: string }[], answers: Record<string, number>) => items.filter((i) => answers[i.id] !== undefined).length;
const fmt = (ms: number) => new Date(ms).toLocaleDateString('he-IL');

export interface ToolRow {
  name: string;
  what: string;
  claimIds: string[];
  note: string;
}

/** "כלים שהועברו" — כל כלי עם מה שהוא בודק ועם המעמד המחקרי שלו. */
export function toolsUsed(report: Report, session: Session): ToolRow[] {
  const rows: ToolRow[] = [
    {
      name: 'שאלון אישיות Mini-IPIP (20 פריטים)',
      what: 'חמש תכונות אישיות (Big Five), בדיווח עצמי',
      claimIds: ['bf_instrument', 'bf_hebrew'],
      note: `נענו ${answered(MINI_IPIP, session.ipip)} מתוך ${MINI_IPIP.length}`,
    },
    {
      name: 'שאלון תחומי עניין בנוסח RIASEC (30 פריטים)',
      what: 'שישה תחומי עניין תעסוקתיים, לפי Holland',
      claimIds: ['riasec_model', 'riasec_items'],
      note: `נענו ${answered(RIASEC_ITEMS, session.riasec)} מתוך ${RIASEC_ITEMS.length}`,
    },
  ];
  const withImage = (pred: (c: ChannelId) => boolean) => report.channels.filter((c) => c.hasImage && pred(c.channel)).map((c) => c.channel);
  const palms = withImage((c) => c.startsWith('palm'));
  if (palms.length) {
    const which = palms.length === 2 ? 'שתי הידיים' : palms[0] === 'palmRight' ? 'יד ימין' : 'יד שמאל';
    rows.push({ name: `צילום כף יד (${which})`, what: 'תיאור הקווים בלבד. המסורת: כירומנטיה', claimIds: ['palm_lines'], note: 'לא נכנס לציונים' });
  }
  if (withImage((c) => c === 'handwriting').length) {
    rows.push({ name: 'דוגמת כתב יד', what: 'תיאור צורת הכתב בלבד. המסורת: גרפולוגיה', claimIds: ['hw_personality'], note: 'לא נכנס לציונים' });
  }
  const draws = withImage((c) => c.startsWith('drawing'));
  if (draws.length) {
    rows.push({
      name: `ציור ${draws.map((d) => (d === 'drawingTree' ? 'עץ' : 'אדם')).join(' ו')}`,
      what: 'תיאור הציור בלבד. המסורות: מבחן העץ, בית־עץ־אדם',
      claimIds: ['drawing_signs'],
      note: 'לא נכנס לציונים',
    });
  }
  const aiRuns = session.aiRuns ?? [];
  const models = [...new Set(aiRuns.map((r) => r.model))];
  if (models.length) {
    const auto = aiRuns.some((r) => r.mode === 'auto');
    const manual = aiRuns.some((r) => r.mode !== 'auto');
    const how = auto && manual
      ? 'בגשר ידני ובשליחה אוטומטית אחרי בדיקת איכות, ושער בקוד'
      : auto
        ? 'בשליחה אוטומטית אחרי בדיקת איכות, ושער בקוד'
        : 'דרך גשר ידני ושער בקוד';
    rows.push({ name: `מודל AI: ${models.join(', ')}`, what: `תיאור תמונה מרשימה סגורה, ${how}`, claimIds: [], note: 'מדד לדיוק התיאור בלבד' });
  }
  return rows;
}

/** "מהלך התהליך" — מה נעשה בפועל. אין בו התרשמות של בודק, כי אף בודק לא פגש את הנבדק. */
export function processLines(report: Report, session: Session): string[] {
  const out: string[] = [];
  // \u2066…\u2069 מבודדים את מספר הגרסה כטקסט משמאל לימין, כדי שלא יתהפך בתוך משפט בעברית.
  if (session.consent) out.push(`הסכמה מדעת ניתנה ב־${fmt(session.consent.acceptedAt)} (טופס \u2066${session.consent.version}\u2069).`);
  else out.push(session.isDemo ? 'תהליך הדגמה: לא נדרשה הסכמה.' : 'לא נרשמה הסכמה מדעת.');
  out.push(`שאלוני דיווח עצמי: אישיות ${answered(MINI_IPIP, session.ipip)}/${MINI_IPIP.length} פריטים, תחומי עניין ${answered(RIASEC_ITEMS, session.riasec)}/${RIASEC_ITEMS.length} פריטים.`);
  const imgs = report.channels.filter((c) => c.hasImage);
  if (imgs.length) {
    const poor = imgs.filter((c) => c.quality?.overall === 'fail').length;
    out.push(
      `תוצרים חזותיים: ${imgs.length} מתוך ${report.channels.length} (${imgs.map((c) => channelById(c.channel).short).join(', ')}).` +
        (poor ? ` ${poor} מהם באיכות צילום נמוכה.` : ' איכות הצילום תקינה.'),
    );
  } else out.push('לא הועלו תוצרים חזותיים.');
  const runs = session.aiRuns ?? [];
  if (runs.length) {
    const agree = runs.reduce((a, r) => a + r.agreement.agree, 0);
    const compared = runs.reduce((a, r) => a + r.agreement.compared, 0);
    const autoN = runs.filter((r) => r.mode === 'auto').length;
    out.push(
      `מודל AI תיאר ${runs.length} תוצרים${autoN ? ` (${autoN === runs.length ? 'כולם נשלחו' : `${autoN} מהם נשלחו`} אוטומטית, אחרי שבדיקת האיכות עברה)` : ''}${compared ? `; הסכמה עם הסימון האנושי ב־${agree} מתוך ${compared} מאפיינים` : ''}.`,
    );
  } else out.push('לא נעשה שימוש במודל AI.');
  out.push('לא התקיימה פגישה ולא נערכה תצפית התנהגותית. אף בודק לא פגש את הנבדק, ולכן אין בדוח התרשמות של בודק.');
  return out;
}

export interface TraitLine {
  key: BigFiveTrait;
  label: string;
  mean: number | null;
  text: string;
}

export function personalityLines(report: Report): TraitLine[] {
  return report.bigFive.map((s) =>
    s.band
      ? { key: s.key, label: BF_BAND_TEXT[s.key].label[s.band], mean: s.mean, text: BF_BAND_TEXT[s.key].text[s.band] }
      : { key: s.key, label: `${BIG_FIVE_NAMES[s.key]}: אין ציון`, mean: null, text: 'חסרים פריטים, ולכן התכונה לא חושבה.' },
  );
}

export interface InterestLine {
  key: RiasecType;
  name: string;
  desc: string;
  fields: string;
}

export function interestLines(report: Report): InterestLine[] {
  if (!report.hollandCode) return [];
  return [...report.hollandCode].map((k) => {
    const key = k as RiasecType;
    return { key, name: RIASEC_NAMES[key], desc: RIASEC_TEXT[key].desc, fields: RIASEC_TEXT[key].fields };
  });
}

/** "תיאור התוצרים" — שורה לכל תוצר: מאפיין וערך, כפי שתוארו. ללא פרשנות. */
export function productLines(report: Report): { channel: ChannelId; title: string; text: string }[] {
  return report.channels
    .filter((c) => c.observations.length)
    .map((c) => {
      const def = channelById(c.channel);
      const parts = def.features
        .map((f) => {
          const o = c.observations.find((x) => x.featureId === f.id);
          if (!o) return null;
          const label = f.label.replace(/\s*\(מחושב\)$/, '');
          let value = o.value;
          if (f.id === 'hw.lines' && c.computed?.textLines !== undefined) value = `${c.computed.textLines} (${o.value})`;
          if (f.id === 'drawing.size' && c.computed) value = `${o.value}, ${(c.computed.bboxAreaRatio * 100).toFixed(0)}% מהדף`;
          return `${label}: ${value}`;
        })
        .filter(Boolean);
      return { channel: c.channel, title: def.title, text: parts.join(' · ') };
    });
}

/** "סיכום" — ארבעה משפטים: אישיות, תחומי עניין, שלב השילוב, ועל מה הממצאים נשענים. */
export function summaryLines(report: Report): string[] {
  const out: string[] = [];
  const computed = report.bigFive.filter((b) => b.band);
  const extremes = computed.filter((b) => b.band === 'high' || b.band === 'low');
  if (!computed.length) out.push('שאלון האישיות לא הושלם, ולכן אין בדוח סיכום אישיותי.');
  else if (extremes.length)
    out.push(
      `בשאלון האישיות בולטות: ${extremes.map((b) => `${BF_BAND_TEXT[b.key].label[b.band!]} (${b.mean!.toFixed(2)})`).join(', ')}. ` +
        (computed.length > extremes.length ? 'שאר התכונות בטווח הבינוני.' : ''),
    );
  else out.push('בשאלון האישיות כל התכונות בטווח הבינוני.');

  if (report.hollandCode) {
    const names = [...report.hollandCode].map((k) => RIASEC_NAMES[k as RiasecType]).join(', ');
    out.push(
      `בתחומי העניין התעסוקתיים בולט הקוד ${report.hollandCode}: ${names}.` +
        (report.hollandTie ? ' יש שוויון בין חלק מהתחומים, ולכן הסדר בקוד אינו חד.' : ''),
    );
  } else out.push('שאלון תחומי העניין לא הושלם, ולכן אין בדוח כיוון תעסוקתי.');

  const s = report.synthesis;
  if (s.total === 0) out.push('לא היו טענות מסורתיות לשלב, כי לא תוארו תוצרים חזותיים.');
  else if (s.compared === 0) out.push(`${s.total} טענות מסורתיות על התוצרים לא ניתנו להשוואה לשאלון.`);
  else {
    const p = Math.round(chanceAtLeast(s.matched, s.compared) * 100);
    out.push(
      `בשלב השילוב, הטענות המסורתיות על התוצרים הצביעו לאותו כיוון כמו השאלון ב־${s.matched} מתוך ${s.compared} השוואות. ` +
        (p > 5
          ? `תוצאה כזו יוצאת בניחוש בערך ב־${p}% מהפעמים, כלומר היא לא חורגת מהמקרה.`
          : `תוצאה כזו נדירה בניחוש (${p}%), אבל אצל אדם אחד היא עדיין לא מראה תוקף.`),
    );
  }
  out.push(
    'לכן הממצאים בדוח נשענים על השאלונים בלבד. כף היד, הכתב והציורים מתוארים כפי שהם, והפרשנויות המסורתיות מוצגות לצד רמת הראיות שלהן.',
  );
  return out;
}

export function strengthLines(report: Report): { key: BigFiveTrait; text: string; basis: string }[] {
  return report.bigFive
    .filter((b) => b.band === 'high' || b.band === 'low')
    .map((b) => ({ key: b.key, text: BF_STRENGTH[b.key][b.band as 'high' | 'low'], basis: BF_BAND_TEXT[b.key].label[b.band!] }));
}

export function recommendationLines(report: Report): string[] {
  const out: string[] = [];
  const code = report.hollandCode;
  if (code) {
    const [a, b] = [...code] as RiasecType[];
    out.push(
      `לבדוק כיוונים בתחומים: ${RIASEC_TEXT[a].fields}` + (b ? `; וגם: ${RIASEC_TEXT[b].fields}` : '') + `. אלה כיווני בדיקה לפי הקוד ${code}, לא התאמה מוכחת.`,
    );
    out.push('להשוות את פרופיל העניין לשאלון מתוקף (למשל O*NET Interest Profiler), ולשוחח על התוצאות עם יועץ תעסוקתי מוסמך.');
    out.push('לפני החלטה: שיחות מידע עם אנשים שעובדים בתחומים האלה, או התנסות קצרה בהם.');
  } else out.push('להשלים את שאלון תחומי העניין כדי לקבל כיווני בדיקה תעסוקתיים.');
  out.push('לא לקבל החלטות על לימודים, עבודה או טיפול על סמך הפרשנויות לכף היד, לכתב היד או לציורים.');
  out.push(
    'אם עולה שאלה של קושי בלמידה, בקשב, במצב הרוח או בתפקוד: לפנות לאבחון אצל איש מקצוע מוסמך (פסיכולוג, מאבחן דידקטי או רופא). הדוח הזה לא בודק את התחומים האלה.',
  );
  return out;
}
