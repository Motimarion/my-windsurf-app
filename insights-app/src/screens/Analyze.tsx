import { useEffect, useRef, useState } from 'react';
import type { ImageRecord, Report, Session } from '../types';
import StepNav from '../components/StepNav';
import { StatusBadge } from '../components/ui';
import { buildReport } from '../engine/report';
import { PROVIDERS, dataLeavesText } from '../engine/providers';
import { go } from '../router';

const LAYERS = [
  { id: 'A', label: 'שכבה א׳ — ראייה ממוחשבת מקומית (איכות, מדידות)' },
  { id: 'D', label: 'שכבה ד׳ — חישוב שאלונים' },
  { id: 'B', label: 'שכבה ב׳ — שיוך טענות למקורות ולרמות ראיות' },
  { id: 'C', label: 'שכבה ג׳ — שליפת פרשנויות מסורתיות (בנפרד)' },
  { id: 'E', label: 'שכבה ה׳ — אינטגרציה והשוואות' },
  { id: 'G', label: 'שכבה ז׳ — שילוב כל המקורות לפי נושאים' },
  { id: 'F', label: 'שכבה ו׳ — בקרת איכות' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Props {
  session: Session;
  images: ImageRecord[];
  update: (fn: (s: Session) => Session) => void;
}

export default function Analyze({ session, images, update }: Props) {
  const [done, setDone] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const now = Date.now();
        // החישוב עצמו מהיר; ההשהיה הקצרה רק מאפשרת לראות את סדר השכבות.
        const r = buildReport(session, images, now);
        for (let i = 1; i <= LAYERS.length; i++) {
          await wait(220);
          setDone(i);
        }
        setReport(r);
        update((s) => ({ ...s, analyzedAt: now }));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [session, images, update]);

  const fails = report?.qa.filter((q) => q.status === 'fail').length ?? 0;

  return (
    <>
      <StepNav session={session} images={images} active="analyze" />
      <div className="card">
        <h1>סטטוס הניתוח</h1>
        <ul className="analysis-list" aria-live="polite">
          {LAYERS.map((l, i) => (
            <li key={l.id}>
              {i < done ? <StatusBadge status="ok" label="הושלם" /> : <span className="badge">ממתין</span>}
              <span className={i < done ? '' : 'muted'}>{l.label}</span>
            </li>
          ))}
        </ul>
        {error && (
          <div className="notice warn" role="alert">
            שגיאה בניתוח: {error}
          </div>
        )}
        {report && (
          <div style={{ marginTop: 14 }}>
            <div className={`notice ${fails ? 'warn' : 'info'}`}>
              בקרת איכות: {report.qa.filter((q) => q.status === 'ok').length} תקינות,{' '}
              {report.qa.filter((q) => q.status === 'warn').length} אזהרות, {fails} כשלים.
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => go({ name: 'report', id: session.id })}>
                לצפייה בדוח ←
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>ספקי ניתוח חזותי</h2>
        <p className="small muted">רכיב שלא חובר מוצג כלא פעיל — המערכת לא מציגה ניתוח AI שלא בוצע בפועל.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ספק</th>
                <th>מצב</th>
                <th>מידע יוצא מהמכשיר</th>
                <th>הערה</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.status === 'active' ? <StatusBadge status="ok" label="פעיל" /> : <span className="badge">לא פעיל</span>}</td>
                  <td>{dataLeavesText(p)}</td>
                  <td className="small muted">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
