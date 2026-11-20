import { CLAIMS, LEVEL_LABELS, SOURCES } from '../data/evidence';
import { PROVIDERS, dataLeavesText } from '../engine/providers';
import { FLOW_INPUT, FLOW_ORDER, FLOW_OUTPUT, STATIONS, STORES } from '../data/stations';
import { LevelBadge, StatusBadge } from '../components/ui';
import type { EvidenceLevel } from '../types';

const LAYERS = [
  ['א׳', 'ראייה ממוחשבת', 'בדיקות איכות ומדידות פיקסלים בדפדפן, ותחנת מנוע AI דרך גשר ידני: הקוד מרכיב את הבקשה, והתשובה עוברת בשער רשימה סגורה.'],
  ['ב׳', 'מאגר מחקר', 'טענות מדורגות A–D עם מקורות; כל מקור מסומן אם אומת במאגר אקדמי.'],
  ['ג׳', 'פרשנויות מסורתיות', 'טקסטים בניסוח ״במסורת נטען״, מקושרים חובה לטענה ברמת C/D.'],
  ['ד׳', 'שאלונים', 'Mini-IPIP (20) ו־RIASEC (30), ניקוד הפוך, סולמות חסרים אינם מחושבים.'],
  ['ה׳', 'אינטגרציה', 'השוואת Big Five ↔ RIASEC לפי מטא־אנליזה; תמונות לא נכנסות לציונים.'],
  ['ז׳', 'שילוב', 'כל המקורות לפי נושאים: השאלון כעוגן, ולצידו הטענות מכף היד, מכתב היד ומהציורים, עם כיוון והשוואה לשאלון. לא משנה אף ציון.'],
  ['ו׳', 'בקרת איכות', '10 בדיקות אוטומטיות: מקורות, רמה A מאומתת, רשימה סגורה, אין AI מדומה, חישוב חוזר, שלמות.'],
];

export default function About() {
  return (
    <>
      <h1>על המערכת</h1>
      <div className="card">
        <h2>איך המערכת בנויה: מהקלט אל הפלט</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          בשפת התחנות של הקורס. יש בה מנוע אחד, וכל השאר תחנות קוד.
        </p>
        <div className="notice small" style={{ marginBottom: 10 }}>
          {FLOW_INPUT}
        </div>
        <ol className="stations">
          {STATIONS.map((s) => (
            <li key={s.num} className={s.kind}>
              <span className="num" aria-hidden>
                {s.num}
              </span>
              <div>
                <div className="kind">{s.type}</div>
                <strong>{s.name}</strong>
                <div className="small muted">{s.desc}</div>
                {s.prompt && <div className="prompt">{s.prompt}</div>}
              </div>
            </li>
          ))}
        </ol>
        <div className="notice small" style={{ marginTop: 10 }}>
          {FLOW_OUTPUT}
        </div>
        <p className="small" style={{ marginBottom: 4 }}>
          <strong>מאגרים וזיכרון:</strong>{' '}
          {STORES.map((st) => `${st.name} (${st.desc})`).join(' · ')}
        </p>
        <p className="small" style={{ margin: 0 }}>
          <strong>{FLOW_ORDER}</strong>
        </p>
      </div>

      <div className="card">
        <h2>ארכיטקטורה בשבע שכבות</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {LAYERS.map(([n, name, desc]) => (
                <tr key={n}>
                  <td>
                    <span className="badge accent">שכבה {n}</span>
                  </td>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td className="small muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>סולם הראיות</h2>
        {(['A', 'B', 'C', 'D'] as EvidenceLevel[]).map((l) => (
          <div key={l} className="row small" style={{ padding: '4px 0' }}>
            <LevelBadge level={l} /> <span className="muted">{LEVEL_LABELS[l].long}</span>
          </div>
        ))}
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {CLAIMS.length} טענות · {SOURCES.length} מקורות ({SOURCES.filter((s) => s.verification === 'verified-db').length} אומתו
          במאגר אקדמי, השאר ממתינים לאימות ביבליוגרפי).
        </p>
      </div>

      <div className="card">
        <h2>ספקי ניתוח</h2>
        {PROVIDERS.map((p) => (
          <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <strong>{p.name}</strong>
              {p.status === 'active' ? <StatusBadge status="ok" label="פעיל" /> : <span className="badge">לא פעיל</span>}
              <span className="tiny muted">מידע יוצא מהמכשיר: {dataLeavesText(p)}</span>
            </div>
            <div className="small muted">{p.note}</div>
          </div>
        ))}
      </div>

      <div className="card small">
        <h2>פרטיות</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>כל הנתונים נשמרים ב־IndexedDB של הדפדפן במכשיר זה בלבד. אין שרת.</li>
          <li>
            האפליקציה לא שולחת תמונות. בתחנת ה־AI (רשות) המשתמש מעביר תמונה למודל בעצמו, אחרי הסכמה נפרדת, ורק את העותק
            הנקי.
          </li>
          <li>לא נאסף שם; כינוי התהליך הוא חופשי ואופציונלי.</li>
          <li>תמונה חדשה בערוץ מחליפה את הקודמת (אין צבירת עותקים).</li>
          <li>מחיקת תהליך מוחקת את כל התמונות, התשובות והתצפיות שלו בטרנזקציה אחת.</li>
          <li>הגופן (Heebo) מוגש מהאפליקציה עצמה — אין בקשות לשרתים חיצוניים.</li>
          <li>תמונות נשמרות כעותק מקודד מחדש, ללא מטא־נתונים (EXIF: מיקום GPS, דגם מכשיר).</li>
        </ul>
      </div>
    </>
  );
}
