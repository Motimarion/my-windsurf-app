import { CLAIMS, LEVEL_LABELS, SOURCES } from '../data/evidence';
import { PROVIDERS } from '../engine/providers';
import { LevelBadge, StatusBadge } from '../components/ui';
import type { EvidenceLevel } from '../types';

const LAYERS = [
  ['א׳', 'ראייה ממוחשבת', 'בדיקות איכות ומדידות פיקסלים בדפדפן; ממשק מודולרי לספקי AI (כרגע לא מחוברים).'],
  ['ב׳', 'מאגר מחקר', 'טענות מדורגות A–D עם מקורות; כל מקור מסומן אם אומת במאגר אקדמי.'],
  ['ג׳', 'פרשנויות מסורתיות', 'טקסטים בניסוח ״במסורת נטען״, מקושרים חובה לטענה ברמת C/D.'],
  ['ד׳', 'שאלונים', 'Mini-IPIP (20) ו־RIASEC (30), ניקוד הפוך, סולמות חסרים אינם מחושבים.'],
  ['ה׳', 'אינטגרציה', 'השוואת Big Five ↔ RIASEC לפי מטא־אנליזה; תמונות לא נכנסות לציונים.'],
  ['ו׳', 'בקרת איכות', '10 בדיקות אוטומטיות: מקורות, רמה A מאומתת, רשימה סגורה, אין AI מדומה, חישוב חוזר, שלמות.'],
];

export default function About() {
  return (
    <>
      <h1>על המערכת</h1>
      <div className="card">
        <h2>ארכיטקטורה בשש שכבות</h2>
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
            </div>
            <div className="small muted">{p.note}</div>
          </div>
        ))}
      </div>

      <div className="card small">
        <h2>פרטיות</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>כל הנתונים נשמרים ב־IndexedDB של הדפדפן במכשיר זה בלבד. אין שרת.</li>
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
