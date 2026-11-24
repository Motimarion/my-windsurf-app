import { useEffect, useId, useRef, useState } from 'react';
import type { ChannelId, Session } from '../types';
import { REFLECTION_HINTS, REFLECTION_QUESTION } from '../data/reflection';

/**
 * שאלה לחשיבה ליד הפרשנות המסורתית של ערוץ. התשובה נשמרת בתהליך (חצי שנייה אחרי ההקלדה, ומיד ביציאה מהתיבה),
 * והיא חלק מהלמידה ולא מהדוח: לא נכנסת ל־PDF ולהדפסה.
 */
export default function Reflection({
  channel,
  kind,
  session,
  update,
}: {
  channel: ChannelId;
  kind: keyof typeof REFLECTION_HINTS;
  session: Session;
  update: (fn: (s: Session) => Session) => void;
}) {
  const id = useId();
  const [text, setText] = useState(session.reflections?.[channel] ?? '');
  const saved = useRef(text);

  const save = (v: string) => {
    if (v === saved.current) return;
    saved.current = v;
    update((s) => ({ ...s, reflections: { ...s.reflections, [channel]: v } }));
  };

  useEffect(() => {
    const t = setTimeout(() => save(text), 500);
    return () => clearTimeout(t);
    // save קורא רק ל־update היציב ול־ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="reflect no-print">
      <label htmlFor={id} className="small">
        <strong>שאלה לחשיבה:</strong> {REFLECTION_QUESTION}
      </label>
      <textarea
        id={id}
        className="code-box"
        rows={2}
        value={text}
        placeholder="אפשר לכתוב כאן הסבר אחד או שניים"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => save(text)}
      />
      <details>
        <summary className="tiny">דוגמאות להסברים אחרים</summary>
        <ul className="tiny muted">
          {REFLECTION_HINTS[kind].map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </details>
      <p className="tiny muted" style={{ margin: 0 }}>
        התשובה נשמרת בתהליך ולא נכנסת ל־PDF.
      </p>
    </div>
  );
}
