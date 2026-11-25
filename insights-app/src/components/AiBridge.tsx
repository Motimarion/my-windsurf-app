import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChannelId, ImageRecord, Session } from '../types';
import { channelById } from '../data/channels';
import {
  MODEL_CHOICES,
  REJECT_TEXT,
  adoptAi,
  adoptionBlock,
  buildRequest,
  compareWithHuman,
  engineFeatures,
  parseResponse,
  recordRun,
  type GateResult,
} from '../engine/bridge';
import {
  MODEL_SUGGESTIONS,
  autoEligibility,
  callGemini,
  callProxy,
  consumerEligibility,
  useAutoSettings,
} from '../engine/autoAi';
import { IS_CONSUMER, PROXY_URL } from '../edition';
import { StatusBadge, radioKeys, rovingIndex } from './ui';

interface Props {
  session: Session;
  channel: ChannelId;
  img?: ImageRecord;
  update: (fn: (s: Session) => Session) => void;
  toast: (m: string) => void;
}

const MODES = [
  { id: 'auto', label: 'אוטומטי (Gemini API)' },
  { id: 'manual', label: 'ידני (גשר)' },
] as const;
type Mode = (typeof MODES)[number]['id'];

const inputStyle = {
  width: '100%',
  minHeight: 40,
  borderRadius: 10,
  border: '1px solid var(--line)',
  padding: '0 10px',
  background: 'var(--surface)',
  color: 'var(--ink)',
  font: 'inherit',
  boxSizing: 'border-box' as const,
};

/**
 * תחנת מנוע ③ — תיאור תמונה.
 * אוטומטי: אחרי בדיקת האיכות, התמונה נשלחת ל־Gemini API עם מפתח אישי. ידני: המשתמש מעביר את הבקשה בעצמו.
 * בשני המצבים התשובה עוברת בשער הרשימה הסגורה, ומושווית לסימון האנושי.
 */
export default function AiBridge({ session, channel, img, update, toast }: Props) {
  const def = channelById(channel);
  const request = useMemo(() => buildRequest(channel), [channel]);
  const [settings, setSettings] = useAutoSettings();
  const [modeState, setMode] = useState<Mode>(settings.enabled ? 'auto' : 'manual');
  // בגרסת הצרכן אין גשר ידני ואין מפתח: התיאור תמיד אוטומטי, דרך השרת.
  const mode: Mode = IS_CONSUMER ? 'auto' : modeState;
  const [agreed, setAgreed] = useState(false);
  const [model, setModel] = useState<string>(MODEL_CHOICES[0]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // ההגדרות פתוחות עד שהכול מוגדר (בכף יד: כולל אישור חיוב), ולא נסגרות מעצמן באמצע המילוי.
  const [settingsOpen, setSettingsOpen] = useState(
    () => !(settings.enabled && settings.key.trim() && settings.consentAuto) || (def.kind === 'palm' && !settings.paidTier),
  );
  const started = useRef<string | null>(null);
  const reqRef = useRef<HTMLTextAreaElement>(null);

  const current = session.observations[channel] ?? [];
  // הרצה שייכת לתמונה מסוימת; הרצה של תמונה קודמת לא מוצגת ולא חוסמת שליחה של התמונה החדשה.
  const run = session.aiRuns?.find((r) => r.channel === channel && (!r.imageId || r.imageId === img?.id));
  const values = run?.values ?? [];
  const compare = run?.values ? compareWithHuman(channel, current, values) : null;
  const elig = IS_CONSUMER
    ? consumerEligibility(img?.quality.overall, PROXY_URL)
    : autoEligibility(channel, img?.quality.overall, settings);
  const autoModel = `Gemini API · ${settings.model.trim()}`;

  function record(r: GateResult, modelName: string, runMode: 'manual' | 'auto') {
    update((s) =>
      recordRun(s, {
        channel,
        model: modelName,
        at: Date.now(),
        accepted: r.accepted.length,
        rejected: r.rejected.length,
        extraText: r.extraText,
        agreement: compareWithHuman(channel, s.observations[channel] ?? [], r.accepted).agreement,
        adopted: false,
        mode: runMode,
        imageId: img?.id,
        values: r.accepted,
        rejectedItems: r.rejected.map((x) => ({ featureId: x.featureId, value: x.value, reason: REJECT_TEXT[x.reason] })),
        imageUsable: r.imageUsable,
      }),
    );
  }

  // שליחה אוטומטית: פעם אחת לכל תמונה, ורק אם התמונה עברה את בדיקת האיכות ויש מפתח והסכמה.
  useEffect(() => {
    if (mode !== 'auto' || !img || run || !elig.ok || started.current === img.id) return;
    started.current = img.id;
    setError(null);
    setSending(true);
    const job = IS_CONSUMER
      ? callProxy({ url: PROXY_URL, channel, blob: img.blob }).then((r) => ({ text: r.text, model: `Gemini · ${r.model}` }))
      : callGemini({ key: settings.key, model: settings.model, channel, blob: img.blob }).then((text) => ({
          text,
          model: autoModel,
        }));
    job
      .then(({ text, model: modelName }) => {
        const r = parseResponse(text, channel, modelName);
        if (r.error) return setError(`התשובה של המודל לא עברה בשער: ${r.error}`);
        record(r, modelName, 'auto');
        toast(`Gemini תיאר את התמונה: התקבלו ${r.accepted.length}, נדחו ${r.rejected.length}`);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSending(false));
    // record ו־toast נוצרים מחדש בכל רינדור; ההגנה מפני שליחה כפולה היא started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, img, run, elig.ok, settings.key, settings.model, channel, autoModel, attempt]);

  function retry() {
    started.current = null;
    setError(null);
    setAttempt((n) => n + 1);
  }

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(request);
      toast('הבקשה הועתקה. הדביקו אותה בצ׳אט וצרפו את התמונה.');
    } catch {
      reqRef.current?.select();
      toast('ההעתקה האוטומטית חסומה בדפדפן הזה — הטקסט סומן, העתיקו אותו ידנית.');
    }
  }

  function downloadImage() {
    if (!img) return;
    const url = URL.createObjectURL(img.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insights-${channel}.${img.mime === 'image/png' ? 'png' : 'jpg'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function checkManual() {
    const r = parseResponse(answer, channel, model);
    if (r.error) return setError(r.error);
    setError(null);
    record(r, model, 'manual');
  }

  const blocked = adoptionBlock(session, channel, img?.quality.overall);

  function adopt() {
    if (!values.length || blocked) return;
    update((s) => adoptAi(s, channel, values, img?.quality.overall));
    toast(`${values.length} ערכים של ${run?.model ?? 'המודל'} נכנסו לתצפיות (מסומנים "מודל AI")`);
  }

  const set = (patch: Partial<typeof settings>) => setSettings({ ...settings, ...patch });

  return (
    <div className="card" aria-labelledby={`ai-${channel}`}>
      <div className="row spread">
        <h3 id={`ai-${channel}`} style={{ margin: 0 }}>
          תיאור בעזרת מודל AI <span className="small muted">(רשות)</span>
        </h3>
        <span className="badge accent">תחנת מנוע ③</span>
      </div>

      {!IS_CONSUMER && (
        <div className="chips" role="radiogroup" aria-label="אופן השליחה למודל" onKeyDown={radioKeys} style={{ marginTop: 10 }}>
          {MODES.map((m, i) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={mode === m.id}
              tabIndex={rovingIndex(
                i,
                MODES.findIndex((x) => x.id === mode),
              )}
              className={`chip ${mode === m.id ? 'on' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {def.kind === 'palm' && (
        <div className="notice warn small" style={{ marginTop: 10 }}>
          {IS_CONSUMER
            ? 'צילום כף יד הוא מידע ביומטרי. הוא נשלח לתיאור בלבד, והשרת לא שומר אותו.'
            : 'צילום כף יד הוא מידע ביומטרי. להתנסות בכיתה מומלץ להשתמש בציור או בכתב יד, ולא בכף היד.'}
        </div>
      )}

      {mode === 'auto' && (
        <div style={{ marginTop: 10 }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            הסדר קבוע: קודם בדיקת איכות התמונה, ורק אם היא עברה, התמונה (העותק הנקי, בלי מיקום ובלי פרטי מכשיר) נשלחת אוטומטית
            ל־Gemini עם ההנחיה הסמויה. התשובה עוברת בשער הרשימה הסגורה.
            {IS_CONSUMER && ' השרת לא שומר את התמונה.'}
          </p>
          {/* שקיפות לימודית (D34): מה המודל מתבקש לעשות — תקציר, והבקשה המלאה בלחיצה */}
          <details className="prompt-view">
            <summary className="small">
              <strong>מה בדיוק נשלח למודל?</strong> <span className="muted">הצגת הבקשה</span>
            </summary>
            <ul className="small" style={{ margin: '8px 0', paddingInlineStart: 18 }}>
              <li>התמונה בלבד, בלי מיקום ובלי פרטי מכשיר. בלי כינוי, בלי תשובות לשאלונים ובלי ציונים.</li>
              <li>הנחיה סמויה: לתאר ולא לפרש, ולא להסיק דבר על אישיות, רגשות, בריאות, גיל, מגדר או עתיד.</li>
              <li>
                רשימה סגורה של {engineFeatures(channel).length} מאפיינים, ולכל אחד הערכים המותרים. המודל מחזיר JSON בלבד.
              </li>
              <li>הקוד מקבל רק ערכים מהרשימה, וכל טקסט אחר נזרק.</li>
              {IS_CONSUMER && <li>בגרסה הזו ההנחיה והרשימה נמצאות בשרת, והן זהות למה שמוצג כאן.</li>}
            </ul>
            <details>
              <summary className="tiny">הבקשה המלאה</summary>
              <textarea
                className="code-box"
                readOnly
                rows={10}
                value={request}
                aria-label="הבקשה המלאה שנשלחת למודל"
                style={{ marginTop: 6 }}
              />
            </details>
          </details>
          {!IS_CONSUMER && (
            <details className="auto-settings" open={settingsOpen} onToggle={(e) => setSettingsOpen(e.currentTarget.open)}>
              <summary className="small">
                <strong>הגדרות שליחה אוטומטית</strong>{' '}
                <span className="muted">{settings.enabled && settings.key ? '· פעילה' : '· כבויה'}</span>
              </summary>
              <label className="row small" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={settings.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
                <span>שליחה אוטומטית פעילה</span>
              </label>
              <label className="small" style={{ display: 'block', marginTop: 8 }}>
                מפתח Gemini API (נשמר רק בלשונית הזו){' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  איך משיגים מפתח ↗
                </a>
                <input
                  type="password"
                  aria-label="מפתח Gemini API"
                  autoComplete="off"
                  value={settings.key}
                  onChange={(e) => set({ key: e.currentTarget.value })}
                  style={{ ...inputStyle, marginTop: 4, direction: 'ltr' }}
                />
              </label>
              <label className="small" style={{ display: 'block', marginTop: 8 }}>
                מודל
                <input
                  list="gemini-models"
                  aria-label="מודל Gemini"
                  value={settings.model}
                  onChange={(e) => set({ model: e.currentTarget.value })}
                  style={{ ...inputStyle, marginTop: 4, direction: 'ltr' }}
                />
                <datalist id="gemini-models">
                  {MODEL_SUGGESTIONS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label className="row small" style={{ marginTop: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={settings.consentAuto}
                  onChange={(e) => set({ consentAuto: e.currentTarget.checked })}
                  style={{ marginTop: 4 }}
                />
                <span>
                  אני מסכים/ה שכל תמונה שאעלה ושתעבור את בדיקת האיכות תישלח אוטומטית ל־Google Gemini API, ותישמר ותטופל לפי תנאי
                  השירות של Google.
                </span>
              </label>
              <label className="row small" style={{ marginTop: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={settings.paidTier}
                  onChange={(e) => set({ paidTier: e.currentTarget.checked })}
                  style={{ marginTop: 4 }}
                />
                <span>
                  המפתח שלי בפרויקט עם חיוב פעיל (Paid).{' '}
                  <span className="muted">
                    נדרש לצילומי כף יד: בשכבה החינמית Google משתמשת בתוכן לשיפור המוצרים, בודקים אנושיים עשויים לקרוא אותו,
                    והתנאים מבקשים לא לשלוח מידע אישי.
                  </span>
                </span>
              </label>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => setSettings({ ...settings, key: '', enabled: false })}>
                  מחיקת המפתח
                </button>
                <span className="tiny muted">מומלץ להגביל את המפתח בהגדרות Google לכתובת האתר.</span>
              </div>
            </details>
          )}

          {!IS_CONSUMER && settings.enabled && !settings.paidTier && def.kind !== 'palm' && (
            <div className="notice small" style={{ marginTop: 10 }}>
              מפתח בשכבה החינמית: Google עשויה להשתמש בתמונה לשיפור המוצרים, ובודקים אנושיים עשויים לראות אותה. העלו רק תוצר בלי
              שם ובלי פרטים מזהים.
            </div>
          )}

          <div aria-live="polite" style={{ marginTop: 10 }}>
            {!img && <p className="small muted">העלו תמונה. אחרי בדיקת האיכות היא תישלח אוטומטית.</p>}
            {img && sending && (
              <p className="small">
                <span className="badge accent">בדיקת האיכות עברה</span> שולח ל־Gemini…
              </p>
            )}
            {img && !sending && !run && (IS_CONSUMER || settings.enabled) && !elig.ok && (
              <div className={`notice small ${'quality' in elig && elig.quality ? 'warn' : ''}`}>{elig.reason}</div>
            )}
            {img && !sending && !run && elig.ok && error && (
              <button className="btn sm" onClick={retry}>
                שליחה מחדש
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div style={{ marginTop: 10 }}>
          <p className="small muted" style={{ marginTop: 0 }}>
            האפליקציה לא שולחת דבר. היא מרכיבה את <strong>הבקשה</strong> למודל: הנחיה סמויה ורשימה סגורה של ערכים. אתם מעבירים
            אותה, יחד עם התמונה, למודל שבחרתם, ומדביקים כאן את <strong>התשובה</strong>. תחנת קוד בודקת אותה ומקבלת רק ערכים
            מהרשימה.
          </p>
          {!img ? (
            <p className="small muted">יש להעלות תמונה כדי להשתמש בתחנה הזו.</p>
          ) : (
            <>
              <label className="row small" style={{ marginTop: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.currentTarget.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  הבנתי שאם אעביר את התמונה למודל חיצוני, היא תצא מהמכשיר ותישמר לפי תנאי השירות שבחרתי. אעביר רק תמונה שלי, ורק
                  את העותק הנקי (בלי מיקום ובלי פרטי מכשיר).
                </span>
              </label>

              {agreed && (
                <div style={{ marginTop: 12 }}>
                  <div className="tiny muted" style={{ marginBottom: 4 }}>
                    1. הבקשה שהקוד הרכיב
                  </div>
                  <textarea
                    ref={reqRef}
                    className="code-box"
                    readOnly
                    rows={8}
                    value={request}
                    aria-label="הבקשה למודל: הנחיה סמויה ורשימת הערכים המותרים"
                    dir="rtl"
                  />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn sm primary" onClick={copyRequest}>
                      העתקת הבקשה
                    </button>
                    <button className="btn sm" onClick={downloadImage}>
                      הורדת העותק הנקי של התמונה
                    </button>
                    <a className="btn sm" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">
                      פתיחת Gemini ↗
                    </a>
                  </div>
                  <p className="tiny muted" style={{ marginTop: 6 }}>
                    בצ׳אט: הדביקו את הבקשה, צרפו את התמונה ששמרתם, ושלחו. אפשר גם ChatGPT או Claude.
                  </p>

                  <div className="tiny muted" style={{ margin: '12px 0 4px' }}>
                    2. לאיזה מודל שלחתם?
                  </div>
                  <div className="chips" role="radiogroup" aria-label="המודל שקיבל את הבקשה" onKeyDown={radioKeys}>
                    {MODEL_CHOICES.map((m, i) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={model === m}
                        tabIndex={rovingIndex(i, MODEL_CHOICES.indexOf(model as (typeof MODEL_CHOICES)[number]))}
                        className={`chip ${model === m ? 'on' : ''}`}
                        onClick={() => setModel(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="tiny muted" style={{ margin: '12px 0 4px' }}>
                    3. התשובה של המודל
                  </div>
                  <textarea
                    className="code-box"
                    rows={6}
                    value={answer}
                    onChange={(e) => setAnswer(e.currentTarget.value)}
                    placeholder='הדביקו כאן את כל התשובה, למשל {"observations":[...]}'
                    aria-label="התשובה של המודל"
                    dir="auto"
                  />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn sm primary" onClick={checkManual} disabled={!answer.trim()}>
                      בדיקה בשער הרשימה הסגורה
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <div className="notice warn small" role="alert" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        {run && compare && (
          <div style={{ marginTop: 12 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              התוצאה האחרונה · {run.model} · {run.mode === 'auto' ? 'נשלח אוטומטית אחרי שבדיקת האיכות עברה' : 'הודבק ידנית'}
            </div>
            <div className="row">
              <StatusBadge status="ok" label={`התקבלו ${run.accepted}`} />
              <StatusBadge status={run.rejected ? 'warn' : 'ok'} label={`נדחו ${run.rejected}`} />
              {compare.agreement.compared > 0 && (
                <span className="badge accent">
                  הסכמה עם הסימון שלכם: {compare.agreement.agree} מתוך {compare.agreement.compared}
                </span>
              )}
            </div>
            {run.extraText && (
              <div className="notice small" style={{ marginTop: 8 }}>
                המודל כתב גם טקסט מחוץ ל־JSON (הסבר או פרשנות). השער התעלם ממנו — רק הערכים מהרשימה נכנסים.
              </div>
            )}
            {run.imageUsable === false && (
              <div className="notice warn small" style={{ marginTop: 8 }}>
                לדברי המודל התמונה לא מתאימה לתיאור. כדאי לצלם מחדש לפי הוראות הצילום.
              </div>
            )}
            {(run.rejectedItems?.length ?? 0) > 0 && (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <caption className="tiny muted" style={{ textAlign: 'start' }}>
                    מה השער דחה
                  </caption>
                  <tbody>
                    {run.rejectedItems!.map((r, i) => (
                      <tr key={`${r.featureId}-${i}`}>
                        <td className="tiny">
                          <bdi>{r.featureId}</bdi>
                        </td>
                        <td className="tiny">
                          <bdi>{r.value}</bdi>
                        </td>
                        <td className="tiny muted">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <caption className="tiny muted" style={{ textAlign: 'start' }}>
                  השוואה: אתם מול המודל (דיוק התיאור בלבד — לא תוקף פסיכולוגי)
                </caption>
                <thead>
                  <tr>
                    <th className="tiny">מאפיין</th>
                    <th className="tiny">הסימון שלכם</th>
                    <th className="tiny">המודל</th>
                    <th className="tiny">התאמה</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.rows.map((r) => (
                    <tr key={r.featureId}>
                      <td className="tiny">{r.label}</td>
                      <td className="tiny">{r.human ?? <span className="muted">—</span>}</td>
                      <td className="tiny">{r.ai ?? <span className="muted">—</span>}</td>
                      <td className="tiny">{r.agree === undefined ? '' : r.agree ? '✓' : '✕'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {compare.agreement.compared === 0 && !run.adopted && (
              <p className="tiny muted" style={{ marginTop: 6 }}>
                סמנו בעצמכם את התצפיות למעלה, וההשוואה תתעדכן.
              </p>
            )}
            {run.adopted ? (
              <p className="tiny muted" style={{ marginTop: 8 }}>
                הערכים של המודל אומצו לתצפיות.
              </p>
            ) : (
              values.length > 0 &&
              (blocked ? (
                <div className="notice warn small" role="note" style={{ marginTop: 8 }}>
                  <strong>אי אפשר לאמץ את ערכי המודל.</strong> {blocked} ההשוואה נשמרת לצורכי למידה בלבד.
                </div>
              ) : (
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={adopt}>
                    אימוץ ערכי המודל לתצפיות
                  </button>
                  <span className="tiny muted">אפשר גם להשאיר את הסימון שלכם — ההשוואה נשמרת בכל מקרה.</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
