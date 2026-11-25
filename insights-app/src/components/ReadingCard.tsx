import { useMemo } from 'react';
import type { Report } from '../types';
import { EXTRA_NOTE, interpretiveReading, type ReadingParagraph } from '../engine/reading';

const TONE: Record<ReadingParagraph['tone'], { cls: string; text: string }> = {
  agree: { cls: 'accent', text: 'מסכימים' },
  disagree: { cls: 'trad', text: 'לא מסכימים' },
  mixed: { cls: 'warn', text: 'מסכימים בחלק' },
  open: { cls: '', text: 'אין הכרעה' },
  'questionnaire-only': { cls: '', text: 'שאלון בלבד' },
};

/** סיכום משולב בשפה פשוטה (גרסת הצרכן): השאלונים והמסורות בסיפור אחד, עם סימון ברור של פסאודו־מדע. */
export default function ReadingCard({ report }: { report: Report }) {
  const r = useMemo(() => interpretiveReading(report), [report]);
  return (
    <>
      <div className="notice warn" role="note">
        <strong className="small">{r.notice.title}</strong>
        <p className="small" style={{ margin: '6px 0 0' }}>
          {r.notice.text}
        </p>
      </div>
      <div className="card reading">
        <p className="reading-lead">{r.lead}</p>
        {r.paragraphs.map((p) => (
          <section key={p.id}>
            <h3>
              {p.title} <span className={`badge ${TONE[p.tone].cls}`}>{TONE[p.tone].text}</span>
            </h3>
            <p>{p.story}</p>
          </section>
        ))}
        {r.extra.length > 0 && (
          <section>
            <h3>עוד מה שהמסורות קוראות בתוצרים</h3>
            <p>
              {r.extra.join(' ')} {EXTRA_NOTE}
            </p>
          </section>
        )}
        {r.work && (
          <section>
            <h3>עבודה ותחומי עניין</h3>
            <p>{r.work}</p>
          </section>
        )}
        <section className="reading-closing">
          <h3>לסיכום</h3>
          <p>{r.closing.join(' ')}</p>
        </section>
      </div>
    </>
  );
}
