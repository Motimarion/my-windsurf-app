import type { ImageRecord, Session } from '../types';
import StepNav, { stepList } from '../components/StepNav';
import { go } from '../router';

const STATE_TEXT = { done: 'הושלם', partial: 'בתהליך', todo: 'טרם התחיל' } as const;
const STATE_BADGE = { done: 'ok', partial: 'warn', todo: '' } as const;

export default function Hub({ session, images }: { session: Session; images: ImageRecord[] }) {
  const steps = stepList(session, images);
  const questDone = steps.filter((s) => s.key === 'ipip' || s.key === 'riasec').every((s) => s.state === 'done');
  const channels = steps.slice(0, 5);
  const quests = steps.slice(5, 7);

  return (
    <>
      <StepNav session={session} images={images} active="hub" />
      <div className="row spread" style={{ marginBottom: 8 }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>{session.label}</h1>
          {session.isDemo && <span className="badge warn">נתוני הדגמה סינתטיים</span>}
        </div>
      </div>

      <div className="card">
        <h2>שאלונים</h2>
        <p className="small muted">הציונים בדוח מחושבים משני השאלונים בלבד. ההתקדמות נשמרת אוטומטית.</p>
        <div className="grid grid-2">
          {quests.map((st) => (
            <button key={st.key} className="card flat" style={{ textAlign: 'start', cursor: 'pointer', margin: 0, font: 'inherit', color: 'inherit' }} onClick={() => go(st.route)}>
              <div className="row spread">
                <strong>
                  {st.icon} {st.key === 'ipip' ? 'שאלון אישיות — Mini-IPIP (20 פריטים)' : 'נטיות תעסוקתיות — RIASEC (30 פריטים)'}
                </strong>
                <span className={`badge ${STATE_BADGE[st.state]}`}>{STATE_TEXT[st.state]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>תמונות (רשות)</h2>
        <p className="small muted">כל ערוץ כולל הוראות צילום ובדיקת איכות. אפשר לדלג על כל ערוץ.</p>
        <div className="grid grid-3">
          {channels.map((st) => (
            <button key={st.key} className="card flat" style={{ textAlign: 'start', cursor: 'pointer', margin: 0, font: 'inherit', color: 'inherit' }} onClick={() => go(st.route)}>
              <div style={{ fontSize: 28 }} aria-hidden>
                {st.icon}
              </div>
              <div className="row spread">
                <strong>{st.label}</strong>
                <span className={`badge ${STATE_BADGE[st.state]}`}>{STATE_TEXT[st.state]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <div>
            <h2 style={{ marginBottom: 4 }}>הפקת הדוח</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {questDone ? 'השאלונים הושלמו — אפשר להריץ ניתוח.' : 'אפשר להריץ ניתוח גם עם נתונים חלקיים; סולמות חסרים יסומנו.'}
            </p>
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => go({ name: 'analyze', id: session.id })}>
              הרצת ניתוח
            </button>
            {session.analyzedAt && (
              <button className="btn" onClick={() => go({ name: 'report', id: session.id })}>
                לדוח האחרון
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
