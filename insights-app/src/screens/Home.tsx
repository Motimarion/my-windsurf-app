import { useEffect, useState } from 'react';
import type { Session } from '../types';
import { deleteAll, deleteSession, listSessions, saveSession, uid } from '../storage/db';
import { go } from '../router';
import { ConfirmDelete, fmtDate } from '../components/ui';
import { demoImages, demoSession } from '../demo/synthetic';
import { ingestImage, mergeComputed } from '../engine/ingest';

export default function Home({ toast }: { toast: (m: string) => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirm, setConfirm] = useState<null | { id?: string }>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listSessions().then(setSessions).catch(() => setSessions([]));
  useEffect(() => {
    load();
  }, []);

  async function startDemo() {
    setBusy(true);
    try {
      const id = uid();
      let s = demoSession(id);
      await saveSession(s);
      for (const { channel, blob } of await demoImages()) {
        const { obs } = await ingestImage(id, channel, blob);
        s = mergeComputed(s, channel, obs, true);
      }
      await saveSession(s);
      go({ name: 'hub', id });
    } catch (e) {
      toast(`יצירת ההדגמה נכשלה: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirm) return;
    if (confirm.id) await deleteSession(confirm.id);
    else await deleteAll();
    setConfirm(null);
    toast('הנתונים נמחקו מהמכשיר');
    load();
  }

  return (
    <>
      <section className="hero">
        <span className="badge accent">גרסת מחקר והדגמה · MVP</span>
        <h1 style={{ marginTop: 12, marginBottom: 4 }}>כירופולוגיה</h1>
        <p className="hero-tagline">אבחון משולב בקריאה בכף יד, ציור וכתב יד</p>
        <p>
          חמישה מקורות מידע — שאלון אישיות מוכר (בתרגום עברי שטרם תוקף), שאלון תחומי עניין להדגמה, וצילומי כפות ידיים, כתב יד וציורים — בדוח אחד שמפריד
          בבירור בין מה שנמדד, מה שנטען במסורת, ומה שנתמך במחקר.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={() => go({ name: 'consent' })}>
            התחלת תהליך חדש
          </button>
          <button className="btn" onClick={startDemo} disabled={busy}>
            {busy ? 'מכין הדגמה…' : 'הדגמה עם נתונים סינתטיים'}
          </button>
          <button className="btn" onClick={() => go({ name: 'learn' })}>
            מצב למידה: מה קורה בפנים
          </button>
        </div>
      </section>

      <div className="grid grid-3">
        <div className="card flat">
          <h3>מה נמדד</h3>
          <p className="small muted">
            שאלון Big Five (Mini-IPIP) ושאלון נטיות תעסוקתיות RIASEC — הציונים מחושבים מהתשובות בלבד.
          </p>
        </div>
        <div className="card flat">
          <h3>מה נצפה</h3>
          <p className="small muted">
            תיאור מאפיינים שרואים בתמונות — בדיקות איכות, גודל ומיקום ציור, ספירת שורות, וסימון ידני מרשימה סגורה.
          </p>
        </div>
        <div className="card flat">
          <h3>מה רק נטען</h3>
          <p className="small muted">
            פרשנויות של כירומנטיה, גרפולוגיה וציורים השלכתיים — מוצגות בנפרד, עם דירוג הראיות המחקריות לצידן.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <h2 style={{ margin: 0 }}>תהליכים שמורים במכשיר זה</h2>
          {sessions && sessions.length > 0 && (
            <button className="btn danger sm" onClick={() => setConfirm({})}>
              מחיקת הכל
            </button>
          )}
        </div>
        {sessions === null && <p className="muted">טוען…</p>}
        {sessions?.length === 0 && <p className="muted" style={{ marginTop: 10 }}>אין עדיין תהליכים.</p>}
        {sessions?.map((s) => (
          <div className="session-item" key={s.id}>
            <div>
              <strong>{s.label}</strong> {s.isDemo && <span className="badge warn">סינתטי</span>}
              <div className="tiny muted">עודכן {fmtDate(s.updatedAt)}</div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => go({ name: 'hub', id: s.id })}>
                המשך
              </button>
              {s.analyzedAt && (
                <button className="btn sm" onClick={() => go({ name: 'report', id: s.id })}>
                  דוח
                </button>
              )}
              <button className="btn sm danger" onClick={() => setConfirm({ id: s.id })} aria-label={`מחיקת ${s.label}`}>
                מחיקה
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="notice small">
        המערכת מיועדת למחקר ולהדגמה עם בגירים שהסכימו להשתתף. אין להשתמש בה לקבלה לעבודה, לאבחון או לכל החלטה
        מהותית על אדם. הנתונים נשמרים בדפדפן זה בלבד.
      </div>

      {confirm && (
        <ConfirmDelete
          title={confirm.id ? 'מחיקת התהליך' : 'מחיקת כל התהליכים'}
          body="התמונות, התשובות והתצפיות יימחקו מהמכשיר ולא יהיה אפשר לשחזר אותן."
          onConfirm={doDelete}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
