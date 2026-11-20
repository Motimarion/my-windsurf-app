import { useMemo, useRef, useState } from 'react';
import { useObjectUrls } from '../useObjectUrls';
import type { ImageRecord, Session } from '../types';
import { buildReport } from '../engine/report';
import { BIG_FIVE_DESCRIPTIONS, BIG_FIVE_NAMES, RIASEC_NAMES } from '../data/questionnaires';
import { channelById } from '../data/channels';
import { CLAIMS, claimById, sourceById } from '../data/evidence';
import { RiasecRadar, ScoreBars } from '../components/charts';
import { ConfirmDelete, LevelBadge, SectionTitle, StatusBadge } from '../components/ui';
import StepNav from '../components/StepNav';
import SynthesisView from '../components/SynthesisView';
import {
  InterestText,
  NotAssessedCard,
  PersonalityText,
  ProcessCard,
  ProductsCard,
  RecommendationsCard,
  ReportHeader,
  SignatureCard,
  StrengthsCard,
  SummaryCard,
  ToolsCard,
} from '../components/AssessmentParts';
import { exportPdf } from '../report/pdf';
import { deleteSession } from '../storage/db';
import { go } from '../router';

const SOURCE_TEXT = { manual: 'סימון ידני', computed: 'חישוב אוטומטי', demo: 'ערך הדגמה', ai: 'מודל AI' } as const;
const BAND = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' } as const;

function ClaimLine({ id }: { id: string }) {
  const c = claimById(id);
  if (!c) return null;
  return (
    <div className="small" style={{ marginTop: 8 }}>
      <LevelBadge level={c.level} /> <span className="muted">{c.statement}</span>
    </div>
  );
}

export default function ReportView({ session, images, toast }: { session: Session; images: ImageRecord[]; toast: (m: string) => void }) {
  const report = useMemo(
    () => buildReport(session, images, session.analyzedAt ?? Date.now()),
    [session, images],
  );
  const sheet = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const urlItems = useMemo(() => images.map((i) => ({ key: i.channel, blob: i.blob })), [images]);
  const urls = useObjectUrls(urlItems);

  async function pdf() {
    if (!sheet.current) return;
    setBusy(true);
    try {
      await exportPdf(sheet.current, `insights-report-${session.id.slice(0, 6)}.pdf`);
    } catch (e) {
      toast(`ייצוא ה־PDF נכשל: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await deleteSession(session.id);
    toast('התהליך וכל נתוניו נמחקו');
    go({ name: 'home' });
  }

  const visual = report.channels.filter((c) => c.hasImage || c.observations.length);
  const claimsUsed = CLAIMS.filter((c) => report.claimsUsed.includes(c.id));

  return (
    <>
      <StepNav session={session} images={images} active="report" />
      <div className="row no-print" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={pdf} disabled={busy}>
          {busy ? 'מפיק PDF…' : 'הורדת PDF'}
        </button>
        <button className="btn" onClick={() => window.print()}>
          הדפסה
        </button>
        <button className="btn danger" onClick={() => setConfirm(true)}>
          מחיקת התהליך
        </button>
      </div>

      <div ref={sheet} className="report-sheet" style={{ margin: '0 auto' }}>
        <ReportHeader report={report} session={session} />

        <SectionTitle num="1">כלים שהועברו</SectionTitle>
        <ToolsCard report={report} session={session} />

        <SectionTitle num="2">מהלך התהליך</SectionTitle>
        <ProcessCard report={report} session={session} />

        <SectionTitle num="3">ממצאים: אישיות (Big Five, שאלון Mini-IPIP)</SectionTitle>
        <div className="card">
          <ScoreBars scores={report.bigFive} names={BIG_FIVE_NAMES} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>תכונה</th>
                  <th>ממוצע (1–5)</th>
                  <th>טווח</th>
                  <th>תיאור</th>
                </tr>
              </thead>
              <tbody>
                {report.bigFive.map((s) => (
                  <tr key={s.key}>
                    <td>{BIG_FIVE_NAMES[s.key]}</td>
                    <td>{s.mean?.toFixed(2) ?? `חסר (${s.answered}/${s.total})`}</td>
                    <td>{s.band ? BAND[s.band] : '—'}</td>
                    <td className="small muted">{BIG_FIVE_DESCRIPTIONS[s.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            ״נמוך/בינוני/גבוה״ הם חלוקה תיאורית של הסולם (מתחת ל־2.5 / מעל 3.5) — לא נורמות. ארבעה פריטים לתכונה
            מספקים הערכה גסה בלבד.
          </p>
          <PersonalityText report={report} />
          <ClaimLine id="bf_instrument" />
          <ClaimLine id="bf_hebrew" />
        </div>

        <SectionTitle num="4">ממצאים: תחומי עניין תעסוקתיים (RIASEC)</SectionTitle>
        <div className="card">
          <div className="grid grid-2" style={{ alignItems: 'center' }}>
            <RiasecRadar scores={report.riasec} names={RIASEC_NAMES} />
            <div>
              <div className="small muted">קוד Holland (שלושת התחומים הבולטים)</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '0.2em', direction: 'ltr', textAlign: 'right' }}>
                {report.hollandCode ?? '—'}
              </div>
              {report.hollandTie && (
                <div className="notice warn tiny" style={{ margin: '6px 0' }}>
                  יש שוויון בציונים בין תחומים — הסדר בקוד נקבע לפי הסדר הקנוני R-I-A-S-E-C ואינו משקף הבדל אמיתי.
                </div>
              )}
              <table>
                <tbody>
                  {report.riasec.map((s) => (
                    <tr key={s.key}>
                      <td>{RIASEC_NAMES[s.key]}</td>
                      <td>{s.mean?.toFixed(2) ?? 'חסר'}</td>
                      <td>{s.band ? BAND[s.band] : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <InterestText report={report} />
          <ClaimLine id="riasec_model" />
          <ClaimLine id="riasec_items" />
        </div>

        <SectionTitle num="5">ממצאים: תוצרי כף היד, הכתב והציורים</SectionTitle>
        <ProductsCard report={report} />
        {visual.length === 0 && <div className="card muted">לא הועלו תמונות בתהליך זה.</div>}
        {visual.map((ch) => {
          const def = channelById(ch.channel);
          return (
            <div className="card" key={ch.channel}>
              <div className="row spread">
                <h3 style={{ margin: 0 }}>
                  <span aria-hidden>{def.icon}</span> {def.title}
                </h3>
                {ch.quality && <StatusBadge status={ch.quality.overall} label={`איכות: ${ch.quality.overall === 'ok' ? 'טובה' : ch.quality.overall === 'warn' ? 'סבירה' : 'נמוכה'}`} />}
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'minmax(0,140px) 1fr', marginTop: 10, alignItems: 'start' }}>
                {urls[ch.channel] ? (
                  <img src={urls[ch.channel]} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }} />
                ) : (
                  <div />
                )}
                <div>
                  <div className="tiny muted" style={{ marginBottom: 4 }}>
                    מה נצפה (תיאור בלבד)
                  </div>
                  {ch.observations.length === 0 ? (
                    <p className="small muted">לא סומנו תצפיות.</p>
                  ) : (
                    <table>
                      <tbody>
                        {ch.observations.map((o) => (
                          <tr key={o.featureId}>
                            <td className="small">{def.features.find((f) => f.id === o.featureId)?.label}</td>
                            <td className="small">
                              <strong>{o.value}</strong>
                            </td>
                            <td className="tiny muted">
                              {o.source === 'ai' ? `${SOURCE_TEXT.ai}${o.model ? ` (${o.model})` : ''} · עבר בשער` : SOURCE_TEXT[o.source]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {(() => {
                    const run = session.aiRuns?.find((r) => r.channel === ch.channel);
                    if (!run) return null;
                    return (
                      <p className="tiny muted" style={{ marginTop: 6 }}>
                        תחנת המנוע: {run.model} תיאר את התמונה
                        {run.mode === 'auto' ? ' (נשלחה אוטומטית אחרי שבדיקת האיכות עברה)' : ''}. התקבלו {run.accepted} ערכים ונדחו {run.rejected}
                        {run.agreement.compared > 0 && `; הסכמה עם הסימון האנושי ${run.agreement.agree} מתוך ${run.agreement.compared}`}
                        {run.adopted ? '; הערכים אומצו' : '; הערכים לא אומצו'}. זהו מדד לדיוק התיאור בלבד, לא לתוקף פסיכולוגי.
                      </p>
                    );
                  })()}
                </div>
              </div>
              {ch.traditions.length > 0 && (
                <div className="notice trad" style={{ marginTop: 12 }}>
                  <div className="row spread" style={{ marginBottom: 6 }}>
                    <strong className="small">מה נטען במסורת — לא ממצא על האדם</strong>
                    <LevelBadge level={claimById(ch.traditions[0].claimId)!.level} />
                  </div>
                  <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
                    {ch.traditions.map((t) => (
                      <li key={t.id}>
                        {t.text} <span className="tiny muted">({t.tradition})</span>
                      </li>
                    ))}
                  </ul>
                  <ClaimLine id={ch.traditions[0].claimId} />
                </div>
              )}
            </div>
          );
        })}

        <SectionTitle num="6">השוואה בין שני השאלונים</SectionTitle>
        <div className="card">
          {report.integration.length === 0 && <p className="muted small">אין מספיק נתונים מלאים להשוואה.</p>}
          <ul style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none' }}>
            {report.integration.map((n) => (
              <li key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }} className="small">
                <span className={`badge ${n.kind === 'consistent' ? 'ok' : n.kind === 'divergent' ? 'warn' : ''}`}>
                  {n.kind === 'consistent' ? 'עקבי' : n.kind === 'divergent' ? 'שונה מהממוצע' : 'מידע'}
                </span>{' '}
                {n.text}
              </li>
            ))}
          </ul>
          <ClaimLine id="integ_bf_riasec" />
        </div>

        <SectionTitle num="7">סיכום ואינטגרציה: כל המקורות יחד</SectionTitle>
        <SummaryCard report={report} />
        <SynthesisView synthesis={report.synthesis} />

        <SectionTitle num="8">חוזקות ונקודות להתבוננות</SectionTitle>
        <StrengthsCard report={report} />
        <div className="card">
          <h3 style={{ marginTop: 0 }}>נקודות להתבוננות</h3>
          <ol className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
            {report.reflections.map((r) => (
              <li key={r.id} style={{ marginBottom: 8 }}>
                {r.text}
              </li>
            ))}
          </ol>
        </div>

        <SectionTitle num="9">המלצות</SectionTitle>
        <RecommendationsCard report={report} />

        <SectionTitle num="10">מגבלות ותחומים שלא נבדקו</SectionTitle>
        <div className="card small">
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>שאלונים בדיווח עצמי מושפעים ממצב רוח, מהקשר ומרצייה חברתית.</li>
            <li>אין נורמות ישראליות לנוסחים בגרסה זו; הציונים אינם מושווים לאוכלוסייה.</li>
            <li>קריאה בכף היד, גרפולוגיה ופירוש ציורים לא הוכחו כמנבאים תקפים של אישיות — ולכן לא שולבו בציונים.</li>
            <li>תחושה ש״פרשנות מתאימה לי״ אינה ראיה לנכונותה (אפקט בַּרְנוּם, מתאם מדומה).</li>
            <li>הסכמה בין כמה מודלי AI על תיאור תמונה אינה ראיה לתוקף פסיכולוגי.</li>
            <li>המדידות האוטומטיות (גודל, מיקום, מספר שורות) רגישות לזווית הצילום ולחיתוך הדף.</li>
          </ul>
        </div>
        <NotAssessedCard />

        <SectionTitle num="11">נספח: מקורות ורמות ראיות</SectionTitle>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>טענה</th>
                  <th>רמה</th>
                  <th>מקורות</th>
                </tr>
              </thead>
              <tbody>
                {claimsUsed.map((c) => (
                  <tr key={c.id}>
                    <td className="small">{c.statement}</td>
                    <td>
                      <LevelBadge level={c.level} />
                    </td>
                    <td className="tiny" style={{ direction: 'ltr', textAlign: 'left' }}>
                      {c.sourceIds.length === 0 && <span className="muted">—</span>}
                      {c.sourceIds.map((sid) => {
                        const s = sourceById(sid)!;
                        return (
                          <div key={sid} style={{ marginBottom: 4 }}>
                            {s.citation}{' '}
                            <span className={`badge ${s.verification === 'verified-db' ? 'ok' : 'warn'}`}>
                              {s.verification === 'verified-db' ? 'אומת במאגר' : 'ממתין לאימות'}
                            </span>
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <SectionTitle num="12">בקרת איכות הדוח</SectionTitle>
        <div className="card">
          <ul className="analysis-list small">
            {report.qa.map((q) => (
              <li key={q.id}>
                <StatusBadge status={q.status} label={q.label} />
                <span className="muted">{q.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <SignatureCard report={report} />
      </div>

      {confirm && (
        <ConfirmDelete
          title="מחיקת התהליך"
          body="הדוח, התמונות, התשובות והתצפיות יימחקו מהמכשיר ולא יהיה אפשר לשחזר אותם."
          onConfirm={remove}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}
