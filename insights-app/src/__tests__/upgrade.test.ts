// בדיקות לשדרוג 25.11.2026: הסרת לחץ כתיבה, תאימות לנתונים ישנים, "לא ניתן לקבוע" לכל מאפיין,
// שאלות רקע שלא משפיעות על ציונים, הפרדת שכבות בקריאה המשולבת, ומצב למידה.
import { describe, expect, it } from 'vitest';
import engineRaw from '../../server/gemini-proxy/engine.json?raw';
import { CHANNELS, TRADITIONS, UNDETERMINED, activeObservations, channelById, isAllowedValue, traditionsFor } from '../data/channels';
import { TRADITION_THEME } from '../data/themes';
import { DEMO_BACKGROUND, DEMO_OBSERVATIONS, demoAnswers } from '../demo/synthetic';
import { ENGINE_SYSTEM_PROMPT, buildUserMessage, parseResponse } from '../engine/bridge';
import { buildReport } from '../engine/report';
import { interpretiveReading } from '../engine/reading';
import { EXERCISES, SAMPLE_MODEL_RESPONSE, buildWalkthrough, feedback } from '../engine/learning';
import { backgroundFor } from '../data/background';
import { href, parse } from '../router';
import type { Observation, Session } from '../types';

const okQuality = { width: 1000, height: 1000, brightness: 200, contrast: 50, sharpness: 100, checks: [], overall: 'ok' as const };
const allImages = CHANNELS.map((c) => ({ channel: c.id, quality: okQuality }));

const session = (over: Partial<Session> = {}): Session => ({
  id: 'up-test',
  label: 't',
  isDemo: true,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ...demoAnswers(),
  observations: structuredClone(DEMO_OBSERVATIONS),
  ...over,
});

describe('לחץ כתיבה הוסר מכל מקום', () => {
  it('לא בסכמה, לא במסורות, לא במיפוי הנושאים ולא בנתוני ההדגמה', () => {
    expect(CHANNELS.flatMap((c) => c.features).some((f) => f.id === 'hw.pressure')).toBe(false);
    expect(TRADITIONS.some((t) => t.featureId === 'hw.pressure')).toBe(false);
    expect(Object.keys(TRADITION_THEME).some((k) => k.startsWith('hw.pressure'))).toBe(false);
    expect(Object.values(DEMO_OBSERVATIONS).flat().some((o) => o!.featureId === 'hw.pressure')).toBe(false);
  });

  it('לא בבקשה למודל ולא בקובץ של השרת', () => {
    expect(buildUserMessage('handwriting')).not.toContain('hw.pressure');
    expect(ENGINE_SYSTEM_PROMPT).toContain('אל תסיק מהתמונה לחץ כתיבה');
    expect(engineRaw).not.toContain('hw.pressure');
  });

  it('השער דוחה לחץ עם סיבה מפורשת', () => {
    const g = parseResponse('{"observations":[{"featureId":"hw.pressure","value":"חזק"}]}', 'handwriting', 'm');
    expect(g.accepted).toEqual([]);
    expect(g.rejected[0].reason).toBe('retired');
  });

  it('תהליך ישן עם לחץ: הנתון נשאר באחסון, לא נכנס לדוח ולא חוזר כטענה', () => {
    const legacy: Observation[] = [
      { featureId: 'hw.pressure', value: 'חזק', source: 'manual' },
      { featureId: 'hw.size', value: 'גדול', source: 'manual' },
    ];
    const s = session({ observations: { handwriting: legacy } });
    const before = JSON.stringify(s);
    const r = buildReport(s, allImages);
    const hw = r.channels.find((c) => c.channel === 'handwriting')!;
    expect(hw.observations.map((o) => o.featureId)).toEqual(['hw.size']);
    expect(hw.traditions.some((t) => t.text.includes('לחץ'))).toBe(false);
    expect(JSON.stringify(r.synthesis)).not.toContain('hw.pressure');
    expect(r.retiredObservations).toBe(1);
    expect(r.qa.find((q) => q.id === 'observations-valid')!.status).toBe('ok');
    expect(r.qa.find((q) => q.id === 'retired-features')!.status).toBe('ok');
    expect(JSON.stringify(s)).toBe(before); // הדוח לא משנה את מה ששמור
  });

  it('ערך ישן "לא ניתן לזהות" מתורגם ל"לא ניתן לקבוע"', () => {
    const out = activeObservations([{ featureId: 'palm.lifeLineArc', value: 'לא ניתן לזהות', source: 'manual' }]);
    expect(out[0].value).toBe(UNDETERMINED);
  });
});

describe('"לא ניתן לקבוע" לכל מאפיין, עם סיבה', () => {
  it('מותר בכל מאפיין שאינו מחושב, ואסור במאפיין מחושב', () => {
    for (const f of CHANNELS.flatMap((c) => c.features)) expect(isAllowedValue(f, UNDETERMINED)).toBe(!f.computed);
  });

  it('השער שומר סיבה וביטחון מהרשימה הקבועה, ומתעלם מערכים אחרים', () => {
    const g = parseResponse(
      JSON.stringify({
        observations: [
          { featureId: 'tree.trunk', value: UNDETERMINED, reason: 'טשטוש', confidence: 'נמוך' },
          { featureId: 'tree.roots', value: UNDETERMINED, reason: 'רוח', confidence: 'בטוח מאוד' },
          { featureId: 'tree.fruit', value: 'מצוירים', confidence: 'גבוה' },
        ],
      }),
      'drawingTree',
      'm',
    );
    expect(g.rejected).toEqual([]);
    expect(g.accepted[0]).toMatchObject({ value: UNDETERMINED, blockedBy: 'טשטוש', confidence: 'נמוך' });
    expect(g.accepted[1].blockedBy).toBe('אחר');
    expect(g.accepted[1].confidence).toBeUndefined();
    expect(g.accepted[2]).toMatchObject({ confidence: 'גבוה' });
    expect(g.accepted[2].blockedBy).toBeUndefined();
  });

  it('אין מסורת על "לא ניתן לקבוע"', () => {
    for (const c of CHANNELS) for (const f of c.features) expect(traditionsFor(c.id, f.id, UNDETERMINED)).toEqual([]);
  });

  it('הבקשה למודל מציעה "לא ניתן לקבוע" ומבקשת סיבה וביטחון', () => {
    expect(buildUserMessage('drawingPerson')).toContain(UNDETERMINED);
    expect(ENGINE_SYSTEM_PROMPT).toContain('"reason"');
    expect(ENGINE_SYSTEM_PROMPT).toContain('"confidence"');
  });
});

describe('שאלות רקע: הקשר בלבד', () => {
  it('ציונים, שילוב ומסורות זהים עם שאלות רקע ובלעדיהן', () => {
    const a = buildReport(session({ background: { ...DEMO_BACKGROUND } }), allImages, 1);
    const b = buildReport(session({ background: undefined }), allImages, 1);
    expect(a.bigFive).toEqual(b.bigFive);
    expect(a.riasec).toEqual(b.riasec);
    expect(a.synthesis).toEqual(b.synthesis);
    expect(a.channels.map((c) => c.traditions)).toEqual(b.channels.map((c) => c.traditions));
    expect(a.background).toEqual(DEMO_BACKGROUND);
  });

  it('כל ערוץ מציג רק את שאלות הרקע שלו', () => {
    expect(backgroundFor('handwriting', DEMO_BACKGROUND).map((b) => b.label)).toEqual(['היד שכתבה', 'מקור הטקסט']);
    expect(backgroundFor('drawingTree', DEMO_BACKGROUND).map((b) => b.label)).toEqual(['זמן ציור העץ', 'ניסיון בציור']);
    expect(backgroundFor('palmLeft', {})).toEqual([]);
  });
});

describe('עץ ואדם ערוצים נפרדים', () => {
  it('הוראות שונות, וכל אחת מבקשת דף נפרד', () => {
    const tree = channelById('drawingTree').instructions.join(' ');
    const person = channelById('drawingPerson').instructions.join(' ');
    expect(tree).not.toBe(person);
    expect(tree).toContain('עץ');
    expect(person).toContain('אדם שלם');
    expect(tree).toContain('דף A4 לבן נפרד');
    expect(person).toContain('דף A4 לבן נפרד');
  });
});

describe('הקריאה המשולבת מפרידה שאלון ממסורת', () => {
  it('כל פסקה שומרת את השאלון ואת הטענות המסורתיות בשדות נפרדים', () => {
    const r = interpretiveReading(buildReport(session(), allImages, 1));
    for (const p of r.paragraphs) {
      for (const t of p.traditionText) expect(p.questionnaire ?? '').not.toContain(t);
    }
    expect(r.paragraphs.some((p) => p.traditionText.length > 0)).toBe(true);
  });
});

describe('מצב למידה', () => {
  const steps = buildWalkthrough();

  it('כל תחנה עם קלט, פעולה, מבצע, פלט ביניים והסבר', () => {
    for (const s of steps) {
      expect(s.input.length && s.action.length && s.explain.length).toBeTruthy();
      expect(s.output.length).toBeGreaterThan(0);
      expect(['קוד', 'AI', 'אדם']).toContain(s.actor);
    }
    expect(new Set(steps.map((s) => s.actor))).toEqual(new Set(['קוד', 'AI', 'אדם']));
  });

  it('רק תשובת המודל מסומנת כנכתבה ביד; כל השאר מחושב', () => {
    expect(steps.filter((s) => s.handWritten).map((s) => s.id)).toEqual(['model']);
    expect(steps.find((s) => s.id === 'model')!.actor).toBe('AI');
  });

  it('פלט השער מחושב מהשער האמיתי: לחץ וערך מחוץ לרשימה נדחים, הטקסט החופשי לא נכנס', () => {
    const gate = steps.find((s) => s.id === 'gate')!.output.join('\n');
    expect(gate).toContain('נדחה: hw.pressure');
    expect(gate).toContain('נדחה: hw.spacing = מרווח מאוד');
    expect(gate).toContain('התעלמות מלאה');
    const g = parseResponse(SAMPLE_MODEL_RESPONSE, 'handwriting', 'x');
    expect(g.accepted.length).toBe(3);
    expect(g.rejected.length).toBe(2);
  });

  it('הציונים בתחנת הניקוד מגיעים מתחנת קוד', () => {
    expect(steps.find((s) => s.id === 'scores')!.actor).toBe('קוד');
    expect(steps.find((s) => s.id === 'report')!.output.join(' ')).toContain('0 נכשלו');
  });

  it('לפחות ארבעה תרגילים, ובכולם משוב שמסביר — גם לתשובה נכונה וגם לשגויה', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(4);
    for (const ex of ['json', 'who-scores', 'unsupported', 'agreement']) expect(EXERCISES.some((e) => e.id === ex)).toBe(true);
    for (const ex of EXERCISES) {
      expect(ex.options.some((o) => o.id === ex.correct)).toBe(true);
      for (const o of ex.options) {
        const f = feedback(ex, o.id);
        expect(f.correct).toBe(o.id === ex.correct);
        expect(f.text.length).toBeGreaterThan(40);
      }
    }
  });

  it('משוב תרגיל ה־JSON מחושב מהשער', () => {
    const ex = EXERCISES.find((e) => e.id === 'json')!;
    expect(feedback(ex, 'b').text).toContain('השער החזיר שגיאה');
    expect(feedback(ex, 'c').text).toContain('ערך מחוץ לרשימה הסגורה');
    expect(feedback(ex, 'a').text).toContain('השער קיבל');
  });

  it('ניתוב למסך הלמידה', () => {
    expect(parse(href({ name: 'learn' }))).toEqual({ name: 'learn' });
  });
});

// ---------- רגרסיה לממצאי הביקורת העצמאית (בסיס 05b9dec) ----------
import { adoptAi, adoptionBlock } from '../engine/bridge';
import { computedObservations } from '../engine/imageAnalysis';
import { PROVIDERS, statusLabel } from '../engine/providers';
import type { AiRun } from '../types';

describe('אימוץ ערכי מודל: ערך מהרשימה הוא תנאי הכרחי, לא מספיק', () => {
  const aiVals: Observation[] = [{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai', model: 'Gemini' }];
  const run = (over: Partial<AiRun>): AiRun => ({
    channel: 'drawingTree', model: 'Gemini', at: 1, accepted: 1, rejected: 0, extraText: false,
    agreement: { agree: 0, compared: 0 }, adopted: false, values: aiVals, ...over,
  });
  const base = (r: AiRun) => session({ observations: { drawingTree: [] }, aiRuns: [r] });

  it('imageUsable=false חוסם אימוץ, גם כשכל הערכים תקינים', () => {
    const s = base(run({ imageUsable: false }));
    expect(adoptionBlock(s, 'drawingTree', 'ok')).toContain('imageUsable=false');
    expect(adoptAi(s, 'drawingTree', aiVals, 'ok')).toBe(s);
  });

  it('בדיקת איכות שנכשלה, או אין תמונה, חוסמות אימוץ', () => {
    const s = base(run({ imageUsable: true }));
    expect(adoptAi(s, 'drawingTree', aiVals, 'fail')).toBe(s);
    expect(adoptAi(s, 'drawingTree', aiVals, undefined)).toBe(s);
  });

  it('תמונה תקינה ו־imageUsable=true: האימוץ עובר', () => {
    const out = adoptAi(base(run({ imageUsable: true })), 'drawingTree', aiVals, 'warn');
    expect(out.observations.drawingTree).toEqual(aiVals);
    expect(out.aiRuns![0].adopted).toBe(true);
  });
});

describe('הדוח בודק מחדש: תצפיות רק מתמונה שקיימת ועברה בדיקת איכות', () => {
  it('ערוץ בלי תמונה או עם תמונה שנכשלה — אין תצפיות ואין מסורות', () => {
    const failQ = { ...okQuality, overall: 'fail' as const };
    const imgs = CHANNELS.filter((c) => c.id !== 'palmRight').map((c) => ({ channel: c.id, quality: c.id === 'drawingTree' ? failQ : okQuality }));
    const r = buildReport(session(), imgs, 1);
    for (const id of ['palmRight', 'drawingTree'] as const) {
      const ch = r.channels.find((c) => c.channel === id)!;
      expect(ch.observations).toEqual([]);
      expect(ch.traditions).toEqual([]);
    }
    expect(r.excludedObservations.map((e) => e.channel).sort()).toEqual(['drawingTree', 'palmRight']);
    expect(r.qa.find((q) => q.id === 'observations-need-image')).toBeTruthy();
    expect(JSON.stringify(r.synthesis)).not.toContain('tree.roots');
  });
});

describe('מדידות על דף ריק: הימנעות, לא המצאת תצפית', () => {
  const empty = { inkCoverage: 0, bboxAreaRatio: 0, centerX: 0.5, centerY: 0.5, textLines: 0 };
  it('אין "קטן", "מרכז" או "1–3" כשאין דיו', () => {
    expect(computedObservations('drawingTree', empty)).toEqual([]);
    expect(computedObservations('drawingPerson', empty)).toEqual([]);
    expect(computedObservations('handwriting', empty)).toEqual([]);
  });
  it('0 שורות עם מעט דיו (כתם): אין תצפית שורות', () => {
    expect(computedObservations('handwriting', { ...empty, inkCoverage: 0.001, bboxAreaRatio: 0.001 })).toEqual([]);
  });
});

describe('סטטוס ספקים לא מרמז על הרצה', () => {
  it('Gemini API "זמין — כבוי עד הפעלה", הגשר "רק כשהמשתמש מעביר", Claude API "לא מחובר"', () => {
    const by = (id: string) => statusLabel(PROVIDERS.find((p) => p.id === id)!).text;
    expect(by('gemini-api')).toContain('כבוי עד הפעלה');
    expect(by('manual-bridge')).toContain('המשתמש מעביר');
    expect(by('claude-vision')).toBe('לא מחובר');
    expect(by('local-cv')).toBe('פועל במכשיר');
  });
});

import { LAMMA_COURSE_URL, LEARN_TITLE } from '../engine/learning';

describe('קישור ללומדה ב־LAMMA וכותרת מצב הלמידה', () => {
  it('הקישור הוא לקורס שנוצר בפועל, והכותרת לא משתמשת ב"אבחון" ככותרת', () => {
    expect(LAMMA_COURSE_URL).toBe('https://lamma.com/studio/course/c91dbff4-a672-4454-98d6-14e6ca3b5262');
    expect(LEARN_TITLE).toBe('דוח תובנות — הדגמה, לא אבחון');
  });
});

describe('רגרסיה (סקירה של c0ccd72): ערכי AI שאומצו מהרצה עם imageUsable=false לא נכנסים לדוח', () => {
  const aiRun = (over: Partial<AiRun>): AiRun => ({
    channel: 'handwriting', model: 'Gemini', at: 1, accepted: 1, rejected: 0, extraText: false,
    agreement: { agree: 0, compared: 0 }, adopted: true, imageUsable: false, ...over,
  });
  const saved = (run: AiRun) =>
    session({
      observations: {
        handwriting: [
          { featureId: 'hw.size', value: 'גדול', source: 'ai', model: 'Gemini' },
          { featureId: 'hw.slant', value: 'זקופה', source: 'manual' },
          { featureId: 'hw.lines', value: '4–8', source: 'computed' },
        ],
      },
      aiRuns: [run],
    });

  it('השחזור מהסקירה: תמונה תקינה, ערך AI שאומץ, imageUsable=false → לא בדוח, לא במסורת ולא בשילוב', () => {
    const r = buildReport(saved(aiRun({})), allImages, 1);
    const hw = r.channels.find((c) => c.channel === 'handwriting')!;
    expect(hw.observations.some((o) => o.source === 'ai')).toBe(false);
    expect(hw.traditions.some((t) => t.featureId === 'hw.size')).toBe(false);
    expect(JSON.stringify(r.synthesis)).not.toContain('hw.size=גדול');
    expect(r.excludedObservations).toContainEqual({ channel: 'handwriting', count: 1, reason: expect.stringContaining('imageUsable=false') });
    expect(r.qa.find((q) => q.id === 'observations-need-image')!.detail).toContain('imageUsable=false');
    expect(r.qa.filter((q) => q.status === 'fail')).toEqual([]);
  });

  it('תצפיות ידניות וחישוביות באותו ערוץ נשארות', () => {
    const hw = buildReport(saved(aiRun({})), allImages, 1).channels.find((c) => c.channel === 'handwriting')!;
    expect(hw.observations.map((o) => `${o.source}:${o.featureId}`).sort()).toEqual(['computed:hw.lines', 'manual:hw.slant']);
    expect(hw.traditions.some((t) => t.featureId === 'hw.slant')).toBe(true);
  });

  it('אותה הרצה עם imageUsable=true (או בלי השדה, כמו בהרצות ישנות) — ערך ה־AI נשאר', () => {
    for (const run of [aiRun({ imageUsable: true }), aiRun({ imageUsable: undefined })]) {
      const hw = buildReport(saved(run), allImages, 1).channels.find((c) => c.channel === 'handwriting')!;
      expect(hw.observations.some((o) => o.source === 'ai' && o.featureId === 'hw.size')).toBe(true);
    }
  });

  it('הרצה לא שמישה בערוץ אחר לא משפיעה על כתב היד', () => {
    const s = saved(aiRun({ imageUsable: true }));
    s.aiRuns!.push(aiRun({ channel: 'drawingTree' }));
    const hw = buildReport(s, allImages, 1).channels.find((c) => c.channel === 'handwriting')!;
    expect(hw.observations.some((o) => o.source === 'ai')).toBe(true);
  });
});

describe('מצב למידה: אוסף תצפיות אחד לראיות ולדוח (סקירה של c0ccd72)', () => {
  const steps = buildWalkthrough();
  it('תחנת הראיות נגזרת מאותו אוסף שבתחנת הבחירה, ולא מערכי המודל', () => {
    const select = steps.find((s) => s.id === 'select')!;
    expect(select.actor).toBe('אדם');
    const selectedText = select.output.join('\n');
    expect(selectedText).toContain('hw.spacing = מרווח · מקור: סימון אנושי');
    expect(selectedText).not.toContain('מקור: מודל');
    const evidence = steps.find((s) => s.id === 'evidence')!.output.join('\n');
    // "מרווח" במסורת מגיע מהסימון האנושי; הערך של המודל ("מרווח מאוד") נדחה בשער ולא חוזר
    expect(evidence).toContain('מרווחים גדולים');
    expect(evidence).not.toContain('מרווח מאוד');
    expect(steps.find((s) => s.id === 'evidence')!.input).toContain('4ב');
  });
  it('הטענות בתחנת הראיות הן בדיוק הטענות שבדוח לאותו ערוץ', () => {
    const evidence = steps.find((s) => s.id === 'evidence')!.output.map((l) => l.split(' — רמה')[0]).sort();
    const human = DEMO_OBSERVATIONS.handwriting!;
    const r = buildReport(session({ observations: { handwriting: human } }), allImages, 1);
    const inReport = r.channels.find((c) => c.channel === 'handwriting')!.traditions.map((t) => t.text).sort();
    expect(evidence).toEqual(inReport);
  });
  it('תרגיל ההסכמה: התשובה הנכונה לא טוענת שהתיאור נכון, והשאלה בלי "ככמעוקל"', () => {
    const ex = EXERCISES.find((e) => e.id === 'agreement')!;
    expect(ex.question).toContain('כמעוקל');
    expect(ex.question).not.toContain('ככמעוקל');
    const correct = ex.options.find((o) => o.id === ex.correct)!.text;
    expect(correct).toBe('שהתיאור עקבי; אין בכך הוכחה שהוא נכון');
    expect(correct).not.toContain('כנראה');
  });
});
