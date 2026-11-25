import { CLAIMS, LEVEL_LABELS, SOURCES } from '../data/evidence';
import { PROVIDERS, dataLeavesText, statusLabel } from '../engine/providers';
import { FLOW_INPUT, FLOW_ORDER, FLOW_OUTPUT, STATIONS, STORES } from '../data/stations';
import { LevelBadge, StatusBadge } from '../components/ui';
import type { EvidenceLevel } from '../types';
import { go } from '../router';

const LAYERS = [
  ['א׳', 'ראייה ממוחשבת', 'בדיקות איכות ומדידות פיקסלים בדפדפן, ותחנת מנוע AI: שליחה אוטומטית אחרי בדיקת איכות, או גשר ידני. הקוד מרכיב את הבקשה, והתשובה עוברת בשער רשימה סגורה.'],
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
      <div className="notice info small row spread" style={{ marginBottom: 12 }}>
        <span>רוצים לראות מה קורה בכל תחנה, על דוגמה סינתטית, ולתרגל?</span>
        <button className="btn sm primary" onClick={() => go({ name: 'learn' })}>
          למצב למידה ←
        </button>
      </div>
      <div className="card">
        <h2>איך המערכת בנויה: מהקלט אל הפלט</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          בשפת התחנות של הקורס. יש בה מנוע אחד, וכל השאר תחנות קוד.
        </p>
        <div className="notice small" style={{ marginBottom: 10 }}>
          {FLOW_INPUT}
        </div>
        <p className="small" style={{ marginTop: 0 }}>
          <strong>בגשר הידני האדם מעביר, והקוד אוכף.</strong> המשתמש מעתיק את הבקשה ואת התמונה למודל ומדביק את התשובה. הקוד קובע
          את הסדר (בדיקת איכות קודם), מרכיב את הבקשה, ובודק כל ערך בשער לפני שהוא נשמר. המשתמש לא יכול לדלג על השער.
        </p>
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
              {statusLabel(p).on ? <StatusBadge status="ok" label={statusLabel(p).text} /> : <span className="badge">{statusLabel(p).text}</span>}
              <span className="tiny muted">מידע יוצא מהמכשיר: {dataLeavesText(p)}</span>
            </div>
            <div className="small muted">{p.note}</div>
          </div>
        ))}
      </div>

      <div className="card small">
        <h2>פרטיות</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          <li>האפליקציה עצמה שומרת את הנתונים ב־IndexedDB של הדפדפן במכשיר זה בלבד, בלי שרת משלה.</li>
          <li>
            <strong>זה לא חל על מה שמועבר למודל AI.</strong> תמונה שהעברתם ידנית בגשר (Gemini, ChatGPT, Claude) או ששלחתם אוטומטית
            עם מפתח, יוצאת מהמכשיר ונשמרת אצל הספק לפי תנאי השירות שלו. האפליקציה לא יכולה להבטיח שהספק לא שומר אותה.
          </li>
          <li>
            האפליקציה לא שולחת תמונות, אלא אם הפעלת שליחה אוטומטית ל־Gemini עם מפתח אישי. גם אז נשלח רק העותק הנקי, ורק אחרי
            שהתמונה עברה את בדיקת האיכות. המפתח נשמר רק בלשונית הנוכחית.
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
