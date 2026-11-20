import { useCallback, useEffect, useState } from 'react';
import { go, useRoute } from './router';
import { useSession } from './useSession';
import Home from './screens/Home';
import Consent from './screens/Consent';
import Hub from './screens/Hub';
import Channel from './screens/Channel';
import Quest from './screens/Quest';
import Analyze from './screens/Analyze';
import ReportView from './screens/ReportView';
import About from './screens/About';

function SessionScreens({ id, toast }: { id: string; toast: (m: string) => void }) {
  const route = useRoute();
  const { session, images, update, reloadImages, error } = useSession(id);
  if (error) return <div className="notice warn">{error}</div>;
  if (session === undefined) return <p className="muted">טוען…</p>;
  if (session === null)
    return (
      <div className="card">
        <h2>התהליך לא נמצא</h2>
        <p className="muted">ייתכן שנמחק, או שנוצר בדפדפן אחר.</p>
        <button className="btn" onClick={() => go({ name: 'home' })}>
          למסך הבית
        </button>
      </div>
    );
  switch (route.name) {
    case 'channel':
      return <Channel key={route.channel} session={session} images={images} channel={route.channel} update={update} reloadImages={reloadImages} toast={toast} />;
    case 'quest':
      return <Quest key={route.which} session={session} images={images} which={route.which} update={update} />;
    case 'analyze':
      return <Analyze session={session} images={images} update={update} />;
    case 'report':
      return <ReportView session={session} images={images} toast={toast} />;
    default:
      return <Hub session={session} images={images} />;
  }
}

export default function App() {
  const route = useRoute();
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => setMsg(m), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  const sessionId = 'id' in route ? route.id : null;

  return (
    <>
      <header className="app-header">
        <button className="brand" onClick={() => go({ name: 'home' })} aria-label="מסך הבית">
          <span className="brand-mark" aria-hidden>
            ◈
          </span>
          <span>
            כירופולוגיה
            <small>מחקר והדגמה — לא אבחון</small>
          </span>
        </button>
        <nav className="row">
          <button className="btn ghost sm" onClick={() => go({ name: 'about' })}>
            על המערכת
          </button>
        </nav>
      </header>
      <main className="container">
        {route.name === 'home' && <Home toast={toast} />}
        {route.name === 'consent' && <Consent />}
        {route.name === 'about' && <About />}
        {sessionId && <SessionScreens key={sessionId} id={sessionId} toast={toast} />}
      </main>
      <footer className="footer">כל הנתונים נשמרים במכשיר זה בלבד · גרסת MVP</footer>
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </>
  );
}
