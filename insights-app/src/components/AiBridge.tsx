import { useMemo, useRef, useState } from 'react';
import type { ChannelId, ImageRecord, Session } from '../types';
import { channelById } from '../data/channels';
import {
  MODEL_CHOICES,
  REJECT_TEXT,
  adoptAi,
  buildRequest,
  compareWithHuman,
  parseResponse,
  recordRun,
  type GateResult,
} from '../engine/bridge';
import { StatusBadge, radioKeys, rovingIndex } from './ui';

interface Props {
  session: Session;
  channel: ChannelId;
  img?: ImageRecord;
  update: (fn: (s: Session) => Session) => void;
  toast: (m: string) => void;
}

/**
 * תחנת מנוע ③ דרך "גשר ידני".
 * הקוד מרכיב את הבקשה; המשתמש מעביר אותה למודל ומחזיר את התשובה; שער הרשימה הסגורה בודק אותה.
 */
export default function AiBridge({ session, channel, img, update, toast }: Props) {
  const def = channelById(channel);
  const request = useMemo(() => buildRequest(channel), [channel]);
  const [agreed, setAgreed] = useState(false);
  const [model, setModel] = useState<string>(MODEL_CHOICES[0]);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<GateResult | null>(null);
  const reqRef = useRef<HTMLTextAreaElement>(null);

  const current = session.observations[channel] ?? [];
  const lastRun = session.aiRuns?.find((r) => r.channel === channel);
  const compare = result && !result.error ? compareWithHuman(channel, current, result.accepted) : null;

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

  function check() {
    const r = parseResponse(answer, channel, model);
    setResult(r);
    if (r.error) return;
    const { agreement } = compareWithHuman(channel, current, r.accepted);
    update((s) =>
      recordRun(s, {
        channel,
        model,
        at: Date.now(),
        accepted: r.accepted.length,
        rejected: r.rejected.length,
        extraText: r.extraText,
        agreement,
        adopted: false,
      }),
    );
  }

  function adopt() {
    if (!result || result.error || !result.accepted.length) return;
    update((s) => adoptAi(s, channel, result.accepted));
    toast(`${result.accepted.length} ערכים של ${model} נכנסו לתצפיות (מסומנים "מודל AI")`);
  }

  return (
    <div className="card" aria-labelledby={`ai-${channel}`}>
      <div className="row spread">
        <h3 id={`ai-${channel}`} style={{ margin: 0 }}>
          תיאור בעזרת מודל AI <span className="small muted">(רשות)</span>
        </h3>
        <span className="badge accent">תחנת מנוע ③ · גשר ידני</span>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        האפליקציה לא שולחת דבר. היא מרכיבה את <strong>הבקשה</strong> למודל: הנחיה סמויה ורשימה סגורה של ערכים. אתם מעבירים
        אותה, יחד עם התמונה, למודל שבחרתם, ומדביקים כאן את <strong>התשובה</strong>. תחנת קוד בודקת אותה ומקבלת רק ערכים
        מהרשימה.
      </p>

      {!img ? (
        <p className="small muted">יש להעלות תמונה כדי להשתמש בתחנה הזו.</p>
      ) : (
        <>
          {def.kind === 'palm' && (
            <div className="notice warn small">
              צילום כף יד הוא מידע ביומטרי. להתנסות בכיתה מומלץ להשתמש בציור או בכתב יד, ולא בכף היד.
            </div>
          )}
          <label className="row small" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.currentTarget.checked)} style={{ marginTop: 4 }} />
            <span>
              הבנתי שאם אעביר את התמונה למודל חיצוני, היא תצא מהמכשיר ותישמר לפי תנאי השירות שבחרתי. אעביר רק תמונה שלי,
              ורק את העותק הנקי (בלי מיקום ובלי פרטי מכשיר).
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
                <button className="btn sm primary" onClick={check} disabled={!answer.trim()}>
                  בדיקה בשער הרשימה הסגורה
                </button>
              </div>
            </div>
          )}

          <div aria-live="polite">
            {result?.error && (
              <div className="notice warn small" role="alert" style={{ marginTop: 10 }}>
                {result.error}
              </div>
            )}
            {result && !result.error && compare && (
              <div style={{ marginTop: 12 }}>
                <div className="row">
                  <StatusBadge status="ok" label={`התקבלו ${result.accepted.length}`} />
                  <StatusBadge status={result.rejected.length ? 'warn' : 'ok'} label={`נדחו ${result.rejected.length}`} />
                  {compare.agreement.compared > 0 && (
                    <span className="badge accent">
                      הסכמה עם הסימון שלכם: {compare.agreement.agree} מתוך {compare.agreement.compared}
                    </span>
                  )}
                </div>
                {result.extraText && (
                  <div className="notice small" style={{ marginTop: 8 }}>
                    המודל כתב גם טקסט מחוץ ל־JSON (הסבר או פרשנות). השער התעלם ממנו — רק הערכים מהרשימה נכנסים.
                  </div>
                )}
                {result.imageUsable === false && (
                  <div className="notice warn small" style={{ marginTop: 8 }}>
                    לדברי המודל התמונה לא מתאימה לתיאור. כדאי לצלם מחדש לפי הוראות הצילום.
                  </div>
                )}
                {result.rejected.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table>
                      <caption className="tiny muted" style={{ textAlign: 'start' }}>
                        מה השער דחה
                      </caption>
                      <tbody>
                        {result.rejected.map((r, i) => (
                          <tr key={`${r.featureId}-${i}`}>
                            <td className="tiny">
                              <bdi>{r.featureId}</bdi>
                            </td>
                            <td className="tiny">
                              <bdi>{r.value}</bdi>
                            </td>
                            <td className="tiny muted">{REJECT_TEXT[r.reason]}</td>
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
                        <th className="tiny">{model}</th>
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
                {result.accepted.length > 0 && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn sm" onClick={adopt}>
                      אימוץ ערכי המודל לתצפיות
                    </button>
                    <span className="tiny muted">אפשר גם להשאיר את הסימון שלכם — ההשוואה נשמרת בכל מקרה.</span>
                  </div>
                )}
              </div>
            )}
            {!result && lastRun && (
              <p className="tiny muted" style={{ marginTop: 10 }}>
                הרצה אחרונה: {lastRun.model} · התקבלו {lastRun.accepted}, נדחו {lastRun.rejected}
                {lastRun.agreement.compared > 0 && ` · הסכמה ${lastRun.agreement.agree}/${lastRun.agreement.compared}`}
                {lastRun.adopted ? ' · הערכים אומצו' : ' · הערכים לא אומצו'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
