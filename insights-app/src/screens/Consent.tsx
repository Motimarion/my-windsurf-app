import { useState } from 'react';
import { CONSENT_ITEMS, CONSENT_VERSION } from '../data/consent';
import { saveSession, uid } from '../storage/db';
import { go } from '../router';
import type { Session } from '../types';

export default function Consent() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [label, setLabel] = useState('');
  const all = CONSENT_ITEMS.every((c) => checked[c.id]);

  async function start() {
    const id = uid();
    const now = Date.now();
    const s: Session = {
      id,
      // מזעור מידע: לא מבקשים שם. כינוי חופשי לזיהוי התהליך במכשיר בלבד.
      label: label.trim() || `תהליך ${new Date(now).toLocaleDateString('he-IL')}`,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      consent: { version: CONSENT_VERSION, acceptedAt: now, items: CONSENT_ITEMS.map((c) => c.id) },
      ipip: {},
      riasec: {},
      observations: {},
    };
    await saveSession(s);
    go({ name: 'hub', id });
  }

  return (
    <div className="card">
      <h1>הסכמה מדעת</h1>
      <p className="muted">לפני שמתחילים, חשוב שיהיה ברור מה המערכת עושה — ומה היא לא עושה.</p>

      <div className="notice info" style={{ marginBottom: 16 }}>
        <strong>בקצרה:</strong> תענו על שני שאלונים קצרים (כ־10 דקות) ותוכלו להעלות עד חמש תמונות. הציונים מחושבים
        מהשאלונים בלבד. התמונות מתוארות — אבל לא משמשות לחישוב תכונות, כי אין לכך תוקף מדעי.
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ marginBottom: 8 }}>
          יש לאשר את כל הסעיפים:
        </legend>
        {CONSENT_ITEMS.map((c) => (
          <label key={c.id} className="row" style={{ alignItems: 'flex-start', padding: '8px 0', cursor: 'pointer', flexWrap: 'nowrap' }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, marginTop: 3, flex: 'none' }}
              checked={!!checked[c.id]}
              onChange={(e) => setChecked({ ...checked, [c.id]: e.target.checked })}
            />
            <span>{c.text}</span>
          </label>
        ))}
      </fieldset>

      <label className="stack" style={{ display: 'block', marginTop: 12 }}>
        <span className="small">כינוי לתהליך (לא חובה; אין צורך בשם אמיתי)</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder="למשל: משתתף 07"
          style={{
            width: '100%',
            minHeight: 44,
            borderRadius: 10,
            border: '1px solid var(--line)',
            padding: '0 12px',
            background: 'var(--surface)',
            color: 'var(--ink)',
            font: 'inherit',
          }}
        />
      </label>

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn primary" disabled={!all} onClick={start}>
          אני מסכים/ה — התחלה
        </button>
        <button className="btn ghost" onClick={() => go({ name: 'home' })}>
          חזרה
        </button>
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        גרסת טופס הסכמה: {CONSENT_VERSION}. אפשר לחזור בך ולמחוק את כל הנתונים בכל שלב.
      </p>
    </div>
  );
}
