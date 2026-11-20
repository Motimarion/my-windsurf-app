// חלקי הדוח במבנה של דוח אבחון פסיכו־דידקטי ותעסוקתי.
import type { Report, Session } from '../types';
import { claimById } from '../data/evidence';
import { DEFAULT_REFERRAL, NOT_ASSESSED } from '../data/reportText';
import {
  interestLines,
  personalityLines,
  processLines,
  productLines,
  recommendationLines,
  strengthLines,
  summaryLines,
  toolsUsed,
} from '../engine/narrative';
import { LevelBadge, fmtDate } from './ui';

export function ReportHeader({ report, session }: { report: Report; session: Session }) {
  return (
    <div className="card">
      <div className="row spread">
        <div>
          <span className="tiny muted">דוח תובנות משולב · במבנה של דוח אבחון פסיכו־דידקטי ותעסוקתי · גרסת הדגמה</span>
          <h1 style={{ margin: '4px 0' }}>דוח תובנות: אישיות ותחומי עניין תעסוקתיים</h1>
        </div>
        {report.isDemo && <span className="badge warn">נתונים סינתטיים</span>}
      </div>
      <table className="details" style={{ marginTop: 8 }}>
        <tbody>
          <tr>
            <th>כינוי הנבדק</th>
            <td>{session.label}</td>
          </tr>
          <tr>
            <th>תאריך הפקה</th>
            <td>{fmtDate(report.generatedAt)}</td>
          </tr>
          <tr>
            <th>שאלת הפנייה</th>
            <td>{session.referral?.trim() || DEFAULT_REFERRAL}</td>
          </tr>
          <tr>
            <th>הופק על ידי</th>
            <td>הפקה אוטומטית. אף בודק לא פגש את הנבדק ולא חתם על הדוח.</td>
          </tr>
        </tbody>
      </table>
      <div className="notice warn small" style={{ marginTop: 12 }}>
        <strong>זהו אינו אבחון.</strong> הדוח בנוי במבנה של דוח אבחון כדי להציג את הממצאים בצורה מסודרת, אבל אינו אבחון
        פסיכולוגי, פסיכו־דידקטי או תעסוקתי. הוא מציג תוצאות שאלונים בדיווח עצמי, תיאור של התוצרים (כף יד, כתב יד וציורים)
        ופרשנויות מסורתיות, כל אחד בנפרד ועם דירוג הראיות. אין להשתמש בו להחלטות על קבלה לעבודה, טיפול, השמה או התאמות
        בלימודים.
      </div>
    </div>
  );
}

export function ToolsCard({ report, session }: { report: Report; session: Session }) {
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>כלי</th>
              <th>מה הוא בודק</th>
              <th>מעמד מחקרי</th>
              <th>הערה</th>
            </tr>
          </thead>
          <tbody>
            {toolsUsed(report, session).map((t) => (
              <tr key={t.name}>
                <td className="small">
                  <strong>{t.name}</strong>
                </td>
                <td className="small">{t.what}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {t.claimIds.map((id) => {
                      const c = claimById(id);
                      return c ? <LevelBadge key={id} level={c.level} /> : null;
                    })}
                    {t.claimIds.length === 0 && <span className="tiny muted">—</span>}
                  </div>
                </td>
                <td className="tiny muted">{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        כשמופיעות שתי רמות לשאלון: הראשונה לכלי במקור, השנייה לנוסח העברי או לפריטים שבגרסה הזו.
      </p>
    </div>
  );
}

export function ProcessCard({ report, session }: { report: Report; session: Session }) {
  return (
    <div className="card">
      <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
        {processLines(report, session).map((l) => (
          <li key={l} style={{ marginBottom: 6 }}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonalityText({ report }: { report: Report }) {
  return (
    <div className="narrative">
      <div className="tiny muted" style={{ marginBottom: 4 }}>
        ממצאים בכתב
      </div>
      {personalityLines(report).map((t) => (
        <p key={t.key} className="small" style={{ margin: '0 0 6px' }}>
          <strong>
            {t.label}
            {t.mean !== null && ` (${t.mean.toFixed(2)})`}.
          </strong>{' '}
          {t.text}
        </p>
      ))}
    </div>
  );
}

export function InterestText({ report }: { report: Report }) {
  const lines = interestLines(report);
  if (!lines.length) return null;
  return (
    <div className="narrative">
      <div className="tiny muted" style={{ marginBottom: 4 }}>
        ממצאים בכתב
      </div>
      <p className="small" style={{ margin: '0 0 6px' }}>
        שלושת תחומי העניין הבולטים, לפי הסדר:
      </p>
      {lines.map((l, i) => (
        <p key={l.key} className="small" style={{ margin: '0 0 6px' }}>
          <strong>
            {i + 1}. {l.name}:
          </strong>{' '}
          {l.desc}. <span className="muted">תחומים לדוגמה: {l.fields}.</span>
        </p>
      ))}
    </div>
  );
}

export function ProductsCard({ report }: { report: Report }) {
  const lines = productLines(report);
  if (!lines.length) return null;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>תיאור התוצרים (ללא פרשנות)</h3>
      {lines.map((l) => (
        <p key={l.channel} className="small" style={{ margin: '0 0 8px' }}>
          <strong>{l.title}:</strong> {l.text}.
        </p>
      ))}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        זה תיאור של מה שרואים בתוצר, מתוך רשימה סגורה. בדוח אבחון אמיתי תיאור כזה נשען על בדיקה מובנית ועל נורמות, ואלה לא
        קיימים כאן.
      </p>
    </div>
  );
}

export function SummaryCard({ report }: { report: Report }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>סיכום</h3>
      {summaryLines(report).map((l) => (
        <p key={l} className="small" style={{ margin: '0 0 8px' }}>
          {l}
        </p>
      ))}
    </div>
  );
}

export function StrengthsCard({ report }: { report: Report }) {
  const lines = strengthLines(report);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>חוזקות (לפי השאלון)</h3>
      {lines.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          כל התכונות בטווח הבינוני או שלא חושבו, ולכן לא נגזרו חוזקות בולטות.
        </p>
      ) : (
        <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
          {lines.map((l) => (
            <li key={l.key} style={{ marginBottom: 6 }}>
              {l.text} <span className="tiny muted">({l.basis})</span>
            </li>
          ))}
        </ul>
      )}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        לכל קצה של הסולם יש חוזקות משלו. החוזקות נגזרות מהשאלון בלבד, ולא מהתוצרים החזותיים.
      </p>
    </div>
  );
}

export function RecommendationsCard({ report }: { report: Report }) {
  return (
    <div className="card">
      <ol className="small" style={{ margin: 0, paddingInlineStart: 18 }}>
        {recommendationLines(report).map((l) => (
          <li key={l} style={{ marginBottom: 8 }}>
            {l}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NotAssessedCard() {
  return (
    <div className="card small">
      <strong>תחומים שלא נבדקו</strong>
      <p style={{ margin: '4px 0 6px' }}>אבחון פסיכו־דידקטי בודק את התחומים האלה בכלים מתוקננים. הכלי הזה לא בודק אותם:</p>
      <ul style={{ margin: 0, paddingInlineStart: 18 }}>
        {NOT_ASSESSED.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p style={{ margin: '6px 0 0' }}>
        לכן הדוח לא יכול לשמש אבחון פסיכו־דידקטי, לא קובע לקות או הפרעה, ולא מהווה בסיס להתאמות בלימודים או בבחינות.
      </p>
    </div>
  );
}

export function SignatureCard({ report }: { report: Report }) {
  return (
    <div className="card small signature">
      <div>
        <strong>הפקה:</strong> מערכת "דוח תובנות משולב", גרסת הדגמה · {fmtDate(report.generatedAt)}
      </div>
      <div className="muted">הדוח הופק אוטומטית. הוא לא נבדק ולא נחתם על ידי פסיכולוג, מאבחן דידקטי או יועץ תעסוקתי.</div>
    </div>
  );
}
