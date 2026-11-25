import { useEffect, useMemo, useState } from 'react';
import { EXERCISES, LAMMA_COURSE_TITLE, LAMMA_COURSE_URL, LEARN_TITLE, buildWalkthrough, feedback, type Actor, type WalkStep } from '../engine/learning';
import { go } from '../router';
import { radioKeys, rovingIndex } from '../components/ui';

const ACTOR_CLASS: Record<Actor, string> = { קוד: 'code', AI: 'engine', אדם: 'human' };

function StepCard({ step, open, onToggle }: { step: WalkStep; open: boolean; onToggle: () => void }) {
  const panel = `learn-step-${step.id}`;
  return (
    <li className={`learn-step ${ACTOR_CLASS[step.actor]}`}>
      <button className="learn-step-head" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        <span className="num" aria-hidden>
          {step.num}
        </span>
        <span className="learn-step-title">
          <strong>{step.name}</strong>
          <span className={`badge actor-${ACTOR_CLASS[step.actor]}`}>מבצע: {step.actor}</span>
        </span>
        <span aria-hidden>{open ? '▾' : '◂'}</span>
      </button>
      {open && (
        <div id={panel} className="learn-step-body">
          <dl className="learn-io">
            <dt>קלט</dt>
            <dd>{step.input}</dd>
            <dt>מה קורה</dt>
            <dd>{step.action}</dd>
            <dt>
              פלט ביניים
              {step.handWritten && <span className="badge warn"> נכתב ביד לדוגמה — לא הופעל מודל</span>}
            </dt>
            <dd>
              <pre className="learn-output" dir="auto">
                {step.output.join('\n')}
              </pre>
            </dd>
          </dl>
          <p className="small" style={{ margin: 0 }}>
            <strong>למה זה חשוב:</strong> {step.explain}
          </p>
        </div>
      )}
    </li>
  );
}

function ExerciseCard({ index }: { index: number }) {
  const ex = EXERCISES[index];
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const fb = checked && choice ? feedback(ex, choice) : null;
  const qid = `ex-${ex.id}`;
  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>
        תרגיל {index + 1}: {ex.title}
      </h3>
      <p id={qid} style={{ marginTop: 0 }}>
        {ex.question}
      </p>
      {ex.material && (
        <pre className="learn-output" dir="ltr">
          {ex.material.join('\n')}
        </pre>
      )}
      <div className="stack" role="radiogroup" aria-labelledby={qid} onKeyDown={radioKeys}>
        {ex.options.map((o, i) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={choice === o.id}
            tabIndex={rovingIndex(i, ex.options.findIndex((x) => x.id === choice))}
            className={`chip learn-option ${choice === o.id ? 'on' : ''}`}
            onClick={() => {
              setChoice(o.id);
              setChecked(false);
            }}
          >
            {o.text}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm primary" disabled={!choice} onClick={() => setChecked(true)}>
          בדיקה
        </button>
      </div>
      {fb && (
        <div className={`notice small ${fb.correct ? 'info' : 'warn'}`} role="status" style={{ marginTop: 10 }}>
          <strong>{fb.correct ? '✓ ' : '✗ '}</strong>
          {fb.text}
        </div>
      )}
    </div>
  );
}

export default function Learn() {
  const steps = useMemo(() => buildWalkthrough(), []);
  const [open, setOpen] = useState<Set<string>>(() => new Set([steps[0]?.id]));
  const allOpen = open.size === steps.length;
  useEffect(() => {
    const prev = document.title;
    document.title = `מצב למידה · ${LEARN_TITLE}`;
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <>
      <p className="tiny muted" style={{ margin: 0 }}>
        {LEARN_TITLE}
      </p>
      <h1>מצב למידה: מה קורה בתוך המערכת</h1>
      <div className="card flat lamma-card">
        <div className="row spread">
          <div style={{ minWidth: 0 }}>
            <strong>הלומדה: {LAMMA_COURSE_TITLE}</strong>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              הלומדה ב־LAMMA היא <strong>טיוטה</strong>. היא נפתחת רק למי שיש לו גישה לחשבון או לקורס, ולא בהכרח לכל אחד.
            </p>
          </div>
          <a className="btn sm" href={LAMMA_COURSE_URL} target="_blank" rel="noopener noreferrer">
            פתיחת הלומדה ב־LAMMA ↗<span className="sr-only"> (נפתח בטאב חדש)</span>
          </a>
        </div>
      </div>
      <div className="notice info small">
        מעבר על דוגמה <strong>סינתטית</strong> אחת (דף כתב יד שנוצר בקוד ותשובות שאלון בדויות), תחנה אחר תחנה. כל פלט ביניים כאן
        הוא תוצאה של הרצת הקוד האמיתי של המערכת על הדוגמה. התשובה של המודל היא היחידה שנכתבה ביד, והיא מסומנת. לא מוצגות
        "מחשבות" של מודל — רק מה שנכנס, מה שיצא, ומה הקוד עשה ביניהם.
      </div>

      <div className="card">
        <div className="row spread">
          <h2 style={{ margin: 0 }}>התחנות</h2>
          <button className="btn sm" onClick={() => setOpen(allOpen ? new Set() : new Set(steps.map((s) => s.id)))}>
            {allOpen ? 'לסגור הכול' : 'לפתוח הכול'}
          </button>
        </div>
        <p className="tiny muted">
          <span className="badge actor-code">קוד</span> כללים קבועים שנותנים תמיד אותה תוצאה ·{' '}
          <span className="badge actor-engine">AI</span> מודל שמחזיר טקסט ·{' '}
          <span className="badge actor-human">אדם</span> המשתמש או החוקר
        </p>
        <ol className="learn-steps">
          {steps.map((s) => (
            <StepCard
              key={s.id}
              step={s}
              open={open.has(s.id)}
              onToggle={() =>
                setOpen((prev) => {
                  const n = new Set(prev);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  return n;
                })
              }
            />
          ))}
        </ol>
      </div>

      <h2>תרגול</h2>
      <p className="small muted">חמישה תרגילים קצרים. המשוב מסביר למה, ובתרגיל ה־JSON הוא מחושב מהשער עצמו.</p>
      {EXERCISES.map((e, i) => (
        <ExerciseCard key={e.id} index={i} />
      ))}

      <div className="row no-print">
        <button className="btn" onClick={() => go({ name: 'about' })}>
          → על המערכת
        </button>
        <button className="btn ghost" onClick={() => go({ name: 'home' })}>
          למסך הבית
        </button>
      </div>
    </>
  );
}
