import { describe, expect, it } from 'vitest';
import {
  ENGINE_SYSTEM_PROMPT,
  adoptAi,
  buildRequest,
  clearAi,
  compareWithHuman,
  engineFeatures,
  extractJson,
  parseResponse,
  recordRun,
} from '../engine/bridge';
import { buildReport } from '../engine/report';
import { channelById } from '../data/channels';
import type { AiRun, Session } from '../types';
import promptsDoc from '../../docs/PROMPTS.md?raw';

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  label: '',
  isDemo: false,
  createdAt: 0,
  updatedAt: 0,
  consent: null,
  ipip: {},
  riasec: {},
  observations: {},
  ...over,
});

const run = (over: Partial<AiRun> = {}): AiRun => ({
  channel: 'drawingTree',
  model: 'Gemini',
  at: 1,
  accepted: 1,
  rejected: 0,
  extraText: false,
  agreement: { agree: 0, compared: 0 },
  adopted: true,
  ...over,
});

describe('בקשה לתחנת המנוע', () => {
  it('כוללת את ההנחיה הסמויה ואת כל המאפיינים הלא מחושבים עם הערכים המותרים', () => {
    const req = buildRequest('drawingTree');
    expect(req).toContain(ENGINE_SYSTEM_PROMPT);
    for (const f of engineFeatures('drawingTree')) {
      expect(req).toContain(`- ${f.id} (${f.label}): ${f.options.join(' | ')}`);
    }
  });

  it('לא כוללת מאפיינים שמחושבים בקוד, ולא מידע מהשאלונים', () => {
    const req = buildRequest('drawingTree');
    expect(req).not.toContain('drawing.size');
    expect(req).not.toContain('drawing.placement');
    expect(req).not.toMatch(/IPIP|RIASEC|ציון/);
  });

  it('ההנחיה בקוד זהה להנחיה המתועדת ב־docs/PROMPTS.md', () => {
    expect(promptsDoc).toContain(ENGINE_SYSTEM_PROMPT);
  });
});

describe('שער הרשימה הסגורה', () => {
  it('מקבל ערכים חוקיים ומסמן אותם כ־AI עם שם המודל', () => {
    const r = parseResponse('{"observations":[{"featureId":"tree.roots","value":"מצוירים"}],"imageUsable":true}', 'drawingTree', 'Gemini');
    expect(r.error).toBeUndefined();
    expect(r.accepted).toEqual([{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai', model: 'Gemini' }]);
    expect(r.rejected).toEqual([]);
    expect(r.extraText).toBe(false);
    expect(r.imageUsable).toBe(true);
  });

  it('דוחה ערך מחוץ לרשימה, מאפיין לא קיים, מאפיין מחושב וכפילות — עם סיבה', () => {
    const r = parseResponse(
      JSON.stringify({
        observations: [
          { featureId: 'tree.trunk', value: 'עבה מאוד' },
          { featureId: 'tree.mood', value: 'שמח' },
          { featureId: 'drawing.size', value: 'גדול' },
          { featureId: 'tree.fruit', value: 'מצוירים' },
          { featureId: 'tree.fruit', value: 'לא מצוירים' },
          { value: 'בלי מזהה' },
        ],
      }),
      'drawingTree',
      'Claude',
    );
    expect(r.accepted.map((o) => o.featureId)).toEqual(['tree.fruit']);
    expect(r.rejected.map((x) => x.reason)).toEqual(['not-in-list', 'unknown-feature', 'computed', 'duplicate', 'bad-shape']);
  });

  it('מתעלם מגדרות קוד ומטקסט סביב ה־JSON, ומדווח שהיה טקסט נוסף', () => {
    const raw = 'הנה התיאור [בקצרה]:\n```json\n{"observations":[{"featureId":"hw.size","value":"בינוני"}]}\n```\nהכתב מעיד על ביטחון עצמי {כנראה}.';
    const r = parseResponse(raw, 'handwriting', 'ChatGPT');
    expect(r.accepted).toHaveLength(1);
    expect(r.extraText).toBe(true);
  });

  it('מנרמל רווחים מיותרים, אבל לא "מתקן" ערך שונה', () => {
    const ok = parseResponse('{"observations":[{"featureId":" hw.slant ","value":"קדימה  (בכיוון הכתיבה)"}]}', 'handwriting', 'Gemini');
    expect(ok.accepted).toHaveLength(1);
    const no = parseResponse('{"observations":[{"featureId":"hw.slant","value":"קדימה"}]}', 'handwriting', 'Gemini');
    expect(no.accepted).toHaveLength(0);
    expect(no.rejected[0].reason).toBe('not-in-list');
  });

  it('מחזיר שגיאה כשאין JSON או כשה־JSON שבור', () => {
    expect(parseResponse('בציור יש שורשים עמוקים.', 'drawingTree', 'Gemini').error).toMatch(/לא נמצא/);
    expect(parseResponse('{"observations":[{"featureId":"tree.roots"', 'drawingTree', 'Gemini').error).toMatch(/לא תקין/);
    expect(parseResponse('{"items":[]}', 'drawingTree', 'Gemini').error).toBeDefined();
  });

  it('מקבל גם מערך בלי עטיפה', () => {
    const r = parseResponse('[{"featureId":"tree.ground","value":"מצויר"}]', 'drawingTree', 'Gemini');
    expect(r.accepted).toHaveLength(1);
  });

  it('extractJson מעדיף את האובייקט עם observations', () => {
    const found = extractJson('{"note":"x"} ואז {"observations":[]}');
    expect(found && (found.value as { observations?: unknown }).observations).toEqual([]);
  });
});

describe('השוואה לסימון האנושי ואימוץ', () => {
  it('מחשב הסכמה רק במאפיינים שסומנו בשני הצדדים', () => {
    const human = [
      { featureId: 'tree.roots', value: 'מצוירים', source: 'manual' as const },
      { featureId: 'tree.trunk', value: 'דק', source: 'manual' as const },
      { featureId: 'drawing.size', value: 'קטן', source: 'computed' as const },
    ];
    const ai = parseResponse(
      '{"observations":[{"featureId":"tree.roots","value":"מצוירים"},{"featureId":"tree.trunk","value":"עבה"},{"featureId":"tree.ground","value":"מצויר"}]}',
      'drawingTree',
      'Gemini',
    ).accepted;
    const { rows, agreement } = compareWithHuman('drawingTree', human, ai);
    expect(agreement).toEqual({ agree: 1, compared: 2 });
    expect(rows).toHaveLength(engineFeatures('drawingTree').length);
  });

  it('אימוץ מחליף רק את המאפיינים שהמודל תיאר ושומר את הערכים המחושבים', () => {
    const s = recordRun(
      session({
        observations: {
          drawingTree: [
            { featureId: 'drawing.size', value: 'קטן', source: 'computed' },
            { featureId: 'tree.roots', value: 'לא מצוירים', source: 'manual' },
            { featureId: 'tree.trunk', value: 'דק', source: 'manual' },
          ],
        },
      }),
      run({ adopted: false }),
    );
    const out = adoptAi(s, 'drawingTree', [{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai', model: 'Gemini' }]);
    const obs = out.observations.drawingTree!;
    expect(obs.find((o) => o.featureId === 'tree.roots')).toMatchObject({ value: 'מצוירים', source: 'ai' });
    expect(obs.find((o) => o.featureId === 'tree.trunk')?.source).toBe('manual');
    expect(obs.find((o) => o.featureId === 'drawing.size')?.source).toBe('computed');
    expect(out.aiRuns?.[0].adopted).toBe(true);
  });

  it('החלפה או מחיקה של תמונה מוחקות ערכי AI ותיעוד הרצה של אותו ערוץ בלבד', () => {
    const s = session({
      observations: {
        drawingTree: [{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai' }],
        handwriting: [{ featureId: 'hw.size', value: 'גדול', source: 'ai' }],
      },
      aiRuns: [run(), run({ channel: 'handwriting' })],
    });
    const out = clearAi(s, 'drawingTree');
    expect(out.observations.drawingTree).toEqual([]);
    expect(out.observations.handwriting).toHaveLength(1);
    expect(out.aiRuns?.map((r) => r.channel)).toEqual(['handwriting']);
  });
});

describe('בקרת איכות: אין פלט AI מדומה', () => {
  const img = [{ channel: 'drawingTree' as const, quality: undefined, computed: undefined }];
  const qa = (s: Session) => buildReport(s, img as never).qa.find((q) => q.id === 'no-phantom-ai')!;

  it('ערך AI עם הרצה מתועדת שאומצה — תקין', () => {
    const s = session({
      observations: { drawingTree: [{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai', model: 'Gemini' }] },
      aiRuns: [run()],
    });
    expect(qa(s).status).toBe('ok');
  });

  it('ערך AI בלי הרצה, או עם הרצה שלא אומצה — נכשל', () => {
    const obs = { drawingTree: [{ featureId: 'tree.roots', value: 'מצוירים', source: 'ai' as const }] };
    expect(qa(session({ observations: obs })).status).toBe('fail');
    expect(qa(session({ observations: obs, aiRuns: [run({ adopted: false })] })).status).toBe('fail');
  });

  it('כל ערכי הרשימה של הערוץ קיימים בהגדרה (עקביות הנתונים)', () => {
    for (const f of channelById('drawingTree').features) expect(f.options.length).toBeGreaterThan(1);
  });
});
