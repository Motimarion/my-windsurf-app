import { useState } from 'react';
import type { ImageRecord, Session } from '../types';
import { IPIP_SCALE_LABELS, MINI_IPIP, RIASEC_ITEMS, RIASEC_SCALE_LABELS } from '../data/questionnaires';
import { progress } from '../engine/scoring';
import StepNav from '../components/StepNav';
import { LevelBadge, Progress, radioKeys, rovingIndex } from '../components/ui';
import { go } from '../router';

const PAGE = 10;

interface Props {
  session: Session;
  images: ImageRecord[];
  which: 'ipip' | 'riasec';
  update: (fn: (s: Session) => Session) => void;
}

export default function Quest({ session, images, which, update }: Props) {
  const items = which === 'ipip' ? MINI_IPIP : RIASEC_ITEMS;
  const labels = which === 'ipip' ? IPIP_SCALE_LABELS : RIASEC_SCALE_LABELS;
  const answers = session[which];
  const firstOpen = items.findIndex((i) => answers[i.id] === undefined);
  const [page, setPage] = useState(() => (firstOpen < 0 ? 0 : Math.floor(firstOpen / PAGE)));
  const pages = Math.ceil(items.length / PAGE);
  const p = progress(items, answers);
  const slice = items.slice(page * PAGE, page * PAGE + PAGE);

  function answer(id: string, v: number) {
    update((s) => ({ ...s, [which]: { ...s[which], [id]: v } }));
  }

  return (
    <>
      <StepNav session={session} images={images} active={which} />
      <div className="card">
        <h1>{which === 'ipip' ? 'שאלון אישיות — Mini-IPIP' : 'נטיות תעסוקתיות — RIASEC'}</h1>
        <p className="muted small">
          {which === 'ipip'
            ? 'עד כמה כל משפט מתאר אותך באופן כללי — כפי שאת/ה היום, לא כפי שהיית רוצה להיות.'
            : 'עד כמה היית נהנה/ית לעסוק בכל פעילות — בלי להתחשב בהכשרה, בשכר או ביכולת.'}
        </p>
        <div className="row small" style={{ marginBottom: 6 }}>
          {which === 'ipip' ? <LevelBadge level="A" /> : <LevelBadge level="D" />}
          <span className="muted">
            {which === 'ipip'
              ? 'כלי מתוקף באנגלית; הנוסח העברי הוא תרגום עבודה שטרם תוקף.'
              : 'מודל RIASEC מבוסס; פריטי שאלון זה הם פריטי הדגמה שטרם תוקפו.'}
          </span>
        </div>
        <div className="row spread small" style={{ margin: '12px 0 6px' }}>
          <span>
            {p.done} מתוך {p.total} נענו
          </span>
          <span className="muted">
            עמוד {page + 1} מתוך {pages}
          </span>
        </div>
        <Progress ratio={p.ratio} label="התקדמות בשאלון" />

        <div style={{ marginTop: 10 }}>
          {slice.map((it, k) => (
            <div className="likert-item" key={it.id}>
              <div id={`q-${it.id}`}>
                <span className="muted small">{page * PAGE + k + 1}. </span>
                {it.text}
              </div>
              <div className="likert" role="radiogroup" aria-labelledby={`q-${it.id}`} onKeyDown={radioKeys}>
                {labels.map((l, i) => (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={answers[it.id] === i + 1}
                    tabIndex={rovingIndex(i, (answers[it.id] ?? 0) - 1)}
                    className={answers[it.id] === i + 1 ? 'on' : ''}
                    onClick={() => answer(it.id, i + 1)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="row spread" style={{ marginTop: 14 }}>
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
            → הקודם
          </button>
          {page < pages - 1 ? (
            <button className="btn primary" onClick={() => setPage(page + 1)}>
              הבא ←
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() =>
                go(which === 'ipip' ? { name: 'quest', id: session.id, which: 'riasec' } : { name: 'analyze', id: session.id })
              }
            >
              {which === 'ipip' ? 'לשאלון התעסוקתי ←' : 'לניתוח ←'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
