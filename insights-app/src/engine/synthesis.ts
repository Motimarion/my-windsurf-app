// שלב השילוב: כל המקורות נפגשים לפי נושאים.
// עוגן = השאלון. לצידו: הטענות המסורתיות מכל הערוצים, עם כיוון, מקור התצפית והשוואה לשאלון.
// הפונקציה רק קוראת ציונים שכבר חושבו — היא לא משנה אף ציון.
import type {
  BigFiveTrait,
  ChannelId,
  Direction,
  RiasecType,
  ScaleScore,
  Session,
  Synthesis,
  SynthesisEntry,
  SynthesisTheme,
  TraditionNote,
} from '../types';
import { THEMES, TRADITION_THEME } from '../data/themes';

const bandDir = (band: ScaleScore<string>['band']): Direction | null =>
  band === 'high' ? 1 : band === 'low' ? -1 : band === 'mid' ? 0 : null;

export function synthesize(
  bf: ScaleScore<BigFiveTrait>[],
  ri: ScaleScore<RiasecType>[],
  channels: { channel: ChannelId; traditions: TraditionNote[] }[],
  session: Session,
): Synthesis {
  const themes: SynthesisTheme[] = THEMES.map((def) => {
    const s = def.trait ? bf.find((x) => x.key === def.trait) : undefined;
    const raw = s ? bandDir(s.band) : null;
    const dir: Direction | null = raw === null || raw === 0 ? raw : def.inverted ? (-raw as Direction) : raw;
    return {
      id: def.id,
      title: def.title,
      trait: def.trait,
      inverted: def.inverted,
      band: s?.band ?? null,
      mean: s?.mean ?? null,
      dir,
      riasec: def.riasec.map((k) => ({ key: k, band: ri.find((x) => x.key === k)?.band ?? null })),
      entries: [],
      agreement: 'none',
    };
  });

  for (const ch of channels) {
    for (const note of ch.traditions) {
      const m = TRADITION_THEME[note.id] ?? { theme: 'other' as const, dir: 0 as Direction };
      const theme = themes.find((t) => t.id === m.theme)!;
      const obs = session.observations[ch.channel]?.find((o) => o.featureId === note.featureId && o.value === note.value);
      let vs: SynthesisEntry['vs'] = 'na';
      if (m.theme !== 'other' && m.dir !== 0 && theme.dir !== null) vs = theme.dir === 0 ? 'neutral' : theme.dir === m.dir ? 'match' : 'mismatch';
      theme.entries.push({ channel: ch.channel, note, dir: m.dir, vs, source: obs?.source, model: obs?.model });
    }
  }

  for (const t of themes) {
    const dirs = t.entries.map((e) => e.dir).filter((d) => d !== 0);
    t.agreement = dirs.length === 0 ? 'none' : dirs.length === 1 ? 'single' : dirs.every((d) => d === dirs[0]) ? 'same' : 'mixed';
  }

  const all = themes.flatMap((t) => t.entries);
  return {
    themes,
    compared: all.filter((e) => e.vs === 'match' || e.vs === 'mismatch').length,
    matched: all.filter((e) => e.vs === 'match').length,
    neutral: all.filter((e) => e.vs === 'neutral').length,
    unanchored: themes.find((t) => t.id === 'other')!.entries.length,
    total: all.length,
  };
}

/**
 * הסיכוי לקבל לפחות m התאמות מתוך n השוואות בניחוש (מטבע הוגן לכל השוואה).
 * קירוב בלבד: ההשוואות לא בלתי־תלויות לגמרי (כמה טענות על אותה תכונה).
 */
export function chanceAtLeast(m: number, n: number): number {
  if (n <= 0) return 1;
  let c = 1; // C(n, 0)
  let sum = 0;
  for (let k = 0; k <= n; k++) {
    if (k >= m) sum += c;
    c = (c * (n - k)) / (k + 1);
  }
  return sum / 2 ** n;
}
