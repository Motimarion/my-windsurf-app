import { describe, expect, it } from 'vitest';
import { buildReport } from '../engine/report';
import { interpretiveReading, mergeClaims, plainClaim, READING_NOTICE } from '../engine/reading';
import { CHANNELS, TRADITIONS } from '../data/channels';
import { demoAnswers, DEMO_OBSERVATIONS } from '../demo/synthetic';
import type { Report, Session, SynthesisEntry, SynthesisTheme } from '../types';

const okQuality = {
  width: 1000,
  height: 1000,
  brightness: 200,
  contrast: 50,
  sharpness: 100,
  checks: [],
  overall: 'ok' as const,
};
const images = CHANNELS.map((c) => ({ channel: c.id, quality: okQuality }));
const demo = (over: Partial<Session> = {}): Session => ({
  id: 'd',
  label: 'בדיקה',
  isDemo: true,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ...demoAnswers(),
  observations: structuredClone(DEMO_OBSERVATIONS),
  ...over,
});

const textOf = (r: ReturnType<typeof interpretiveReading>) =>
  [
    r.notice.title,
    r.notice.text,
    r.lead,
    ...r.paragraphs.flatMap((p) => [p.title, p.story]),
    ...r.extra,
    r.work ?? '',
    ...r.closing,
  ].join('\n');

describe('פרשנות משולבת בשפה פשוטה (גרסת הצרכן)', () => {
  it('מסומנת בבירור כפסאודו־מדע ולא כבסיס להחלטות', () => {
    expect(READING_NOTICE.text).toContain('פסאודו־מדעיות');
    expect(READING_NOTICE.text).toContain('אין לקבל החלטות');
    const r = interpretiveReading(buildReport(demo(), images));
    expect(r.notice).toBe(READING_NOTICE);
    expect(r.closing[r.closing.length - 1]).toContain('שיחה עם איש מקצוע');
  });

  it('בלי אבחנות ובלי ניסוח של בודק שפגש את הנבדק', () => {
    const text = textOf(interpretiveReading(buildReport(demo(), images)));
    for (const w of [
      'דיסלקציה',
      'דיסגרפיה',
      'דיסקלקוליה',
      'ADHD',
      'הפרעת',
      'לקות למידה',
      'אובחן',
      'התרשמתי',
      'בפגישה עם',
      'נטען ש',
    ]) {
      expect(text, w).not.toContain(w);
    }
  });

  it('כל טענה בסיכום באה משלב השילוב של אותו נושא, בלי כפילויות', () => {
    const report = buildReport(demo(), images);
    const r = interpretiveReading(report);
    expect(r.paragraphs.length).toBeGreaterThan(0);
    for (const p of r.paragraphs) {
      const theme = report.synthesis.themes.find((t) => t.id === p.id)!;
      const allowed = new Set(theme.entries.map(plainClaim));
      for (const c of p.claims) expect(allowed.has(c), c).toBe(true);
      expect(new Set(p.claims).size).toBe(p.claims.length);
      // כל טענה מופיעה בפסקה המוצגת (בלי שם המסורת ובלי הנקודה, כי טענות מאותו מקור מאוחדות למשפט אחד)
      for (const c of p.claims) expect(p.story, c).toContain(c.slice(c.indexOf(', ') + 2).replace(/\.$/, ''));
      expect(p.story.startsWith(p.questionnaire ?? '')).toBe(true);
      expect(p.story.endsWith(p.verdict)).toBe(true);
    }
    const other = report.synthesis.themes.find((t) => t.id === 'other')!;
    expect(r.extra).toEqual(mergeClaims(other.entries));
  });

  it('כל ניסוח מסורתי במאגר הופך למשפט "לפי ..." עם שם המסורת', () => {
    for (const note of TRADITIONS) {
      const s = plainClaim({ note });
      expect(s, note.id).toMatch(/^לפי [^,]+, /);
      expect(s, note.id).not.toContain('נטען ש');
    }
    const palm = TRADITIONS.find((n) => n.channel === 'palm')!;
    expect(plainClaim({ note: palm })).toMatch(/^לפי הקריאה בכף היד, /);
    const hw = TRADITIONS.find((n) => n.text.startsWith('בגרפולוגיה'))!;
    expect(plainClaim({ note: hw })).toMatch(/^לפי הגרפולוגיה, /);
  });

  it('טענות מאותה מסורת מאוחדות למשפט אחד, וטענה עם הערה נשארת נפרדת', () => {
    const base = TRADITIONS.find((n) => n.text.startsWith('בגרפולוגיה'))!;
    const n = (text: string, channel = base.channel) => ({ note: { ...base, channel, text } });
    expect(
      mergeClaims([
        n('בגרפולוגיה נטען שכתב גדול מבטא ביטחון.'),
        n('במבחן העץ נטען ששורשים מבטאים ביסוס.', 'drawingTree'),
        n('בגרפולוגיה נטען שמרווחים גדולים מבטאים צורך במרחב.'),
        n('בגרפולוגיה נטען שכתב גדול מבטא ביטחון.'),
        n('במסורת נטען שקו מעוקל מבטא דמיון. (הערה.)', 'palm'),
      ]),
    ).toEqual([
      'לפי הגרפולוגיה, כתב גדול מבטא ביטחון, ומרווחים גדולים מבטאים צורך במרחב.',
      'לפי מבחן העץ, שורשים מבטאים ביסוס.',
      'לפי הקריאה בכף היד, קו מעוקל מבטא דמיון. (הערה.)',
    ]);
  });

  it('ההכרעה בכל נושא לפי ההשוואה לשאלון: מסכימים, לא מסכימים, חלקית, או בלי הכרעה', () => {
    const note = TRADITIONS.find((n) => n.text.startsWith('בגרפולוגיה'))!;
    const entry = (vs: SynthesisEntry['vs'], text: string): SynthesisEntry => ({
      channel: 'handwriting',
      note: { ...note, text: `בגרפולוגיה נטען ש${text}` },
      dir: 1,
      vs,
    });
    const theme = (id: SynthesisTheme['id'], dir: SynthesisTheme['dir'], entries: SynthesisEntry[]): SynthesisTheme => ({
      id,
      title: id,
      inverted: id === 'stability',
      band: null,
      mean: null,
      dir,
      riasec: [],
      entries,
      agreement: 'none',
    });
    const themes = [
      theme('extraversion', 1, [entry('match', 'א'), entry('match', 'ב')]),
      theme('warmth', -1, [entry('mismatch', 'ג')]),
      theme('order', 1, [entry('match', 'ד'), entry('mismatch', 'ה')]),
      theme('stability', 0, [entry('neutral', 'ו')]),
      theme('imagination', 1, []),
      theme('other', null, [entry('na', 'ז'), entry('na', 'ז')]),
    ];
    const report = {
      hollandCode: 'SAE',
      hollandTie: false,
      synthesis: { themes, compared: 4, matched: 3, neutral: 1, unanchored: 2, total: 8 },
    } as unknown as Report;
    const r = interpretiveReading(report);
    const tone = Object.fromEntries(r.paragraphs.map((p) => [p.id, p.tone]));
    expect(tone).toEqual({
      extraversion: 'agree',
      warmth: 'disagree',
      order: 'mixed',
      stability: 'open',
      imagination: 'questionnaire-only',
    });
    expect(r.paragraphs.find((p) => p.id === 'warmth')!.verdict).toContain('כדאי לסמוך עליו');
    // יציבות רגשית: הכיוון כבר הפוך לנוירוטיות, ולכן 0 הוא אמצע ולא רגישות
    expect(r.paragraphs.find((p) => p.id === 'stability')!.questionnaire).toContain('תגובה ממוצעת ללחץ');
    expect(r.extra).toEqual(['לפי הגרפולוגיה, ז']);
    // התמונה הכוללת: רק נושאים שבולטים, מופרדים בנקודה־פסיק
    expect(r.closing[0]).toBe(
      'בסך הכול, מהשאלונים עולה תמונה של פתיחות, חברותיות ואנרגיה בחברה; של מיקוד בעניינים אישיים, ופחות עיסוק ברגשות של אחרים; של סדר, שיטתיות והקפדה על משימות; ושל דמיון, יצירתיות וסקרנות לרעיונות.',
    );
    expect(r.closing[1]).toBe('בתחומי העניין בולטים התחום החברתי והתחום האמנותי.');
    expect(r.work).toContain('בפרשנות המסורתית שבכלי אין טענות על תחום עיסוק');
  });

  it('בלי תוצרים: הסיכום נשען על השאלונים בלבד', () => {
    const r = interpretiveReading(buildReport(demo({ observations: {} }), []));
    expect(r.paragraphs.every((p) => p.tone === 'questionnaire-only')).toBe(true);
    expect(r.extra).toEqual([]);
    expect(r.closing.join(' ')).toContain('לא תוארו תוצרים');
  });

  it('בלי שאלון אישיות: אין תמונה אישיותית, והמסורות לא נבדקות מול כלום', () => {
    const r = interpretiveReading(buildReport(demo({ ipip: {} }), images));
    expect(r.closing[0]).toBe('שאלון האישיות לא הושלם, ולכן בסיכום אין תמונה אישיותית.');
    expect(r.paragraphs.every((p) => p.questionnaire === null && p.tone === 'open')).toBe(true);
  });
});
