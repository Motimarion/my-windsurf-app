// שאלות רקע מינימליות לכל ערוץ (רשות).
// הן מוצגות בדוח כהקשר בלבד: לא משמשות לאבחון, לא משנות ציון ולא בוחרות פרשנות מסורתית.
import type { Background, ChannelId } from '../types';
import { BACKGROUND_NOTE, BACKGROUND_QUESTIONS, type BackgroundKey } from '../data/background';
import { radioKeys, rovingIndex } from './ui';

export default function BackgroundQuestions({
  channel,
  background,
  onChange,
}: {
  channel: ChannelId;
  background: Background;
  onChange: (key: BackgroundKey, value: string | undefined) => void;
}) {
  const qs = BACKGROUND_QUESTIONS[channel];
  return (
    <div className="card">
      <h3>שאלות רקע (רשות)</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        {BACKGROUND_NOTE} הן עוזרות לקרוא את התיאור בהקשר. למשל, כתב שהועתק בדרך כלל איטי ומסודר יותר מכתיבה חופשית.
      </p>
      {qs.map((q) => {
        const cur = background[q.key] as string | undefined;
        const id = `bg-${channel}-${q.key}`;
        return (
          <div key={q.key} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="small" id={id}>
              <strong>{q.label}</strong>
            </div>
            <div className="chips" style={{ marginTop: 6 }} role="radiogroup" aria-labelledby={id} onKeyDown={radioKeys}>
              {q.options.map((o, i) => (
                <button
                  key={o}
                  className={`chip ${cur === o ? 'on' : ''}`}
                  role="radio"
                  aria-checked={cur === o}
                  tabIndex={rovingIndex(i, q.options.indexOf(cur ?? ''))}
                  onClick={() => onChange(q.key, cur === o ? undefined : o)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
