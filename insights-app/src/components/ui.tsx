import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { CheckStatus, EvidenceLevel } from '../types';
import { LEVEL_LABELS, LEVEL_MEANING } from '../data/evidence';

const STATUS_TEXT: Record<CheckStatus, string> = { ok: 'תקין', warn: 'אזהרה', fail: 'נכשל' };
const STATUS_ICON: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✕' };

export function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  return (
    <span className={`badge ${status}`} aria-label={STATUS_TEXT[status]}>
      <span aria-hidden>{STATUS_ICON[status]}</span> {label ?? STATUS_TEXT[status]}
    </span>
  );
}

/** תג רמת ראיות. לחיצה פותחת הסבר (בטלפון אין ריחוף עכבר, ולכן title לבדו לא מספיק). */
export function LevelBadge({ level }: { level: EvidenceLevel }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        className={`badge lv${level} badge-btn`}
        title={LEVEL_LABELS[level].long}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        רמה {level} · {LEVEL_LABELS[level].short}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} labelId={titleId}>
          <h3 id={titleId} style={{ marginTop: 0 }}>
            רמה {level} · {LEVEL_LABELS[level].short}
          </h3>
          <p>{LEVEL_LABELS[level].long}.</p>
          <p className="muted">{LEVEL_MEANING[level]}</p>
          <p className="tiny muted">התג אומר כמה המחקר תומך בטענה, לא אם היא נכונה לגביך.</p>
          <button className="btn" onClick={() => setOpen(false)} autoFocus>
            סגירה
          </button>
        </Modal>
      )}
    </>
  );
}

export function Progress({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <span style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}

/** קבוצת רדיו נגישה: רק הכפתור הנבחר (או הראשון) ברצף ה־Tab. */
export const rovingIndex = (i: number, selected: number) => (i === (selected >= 0 ? selected : 0) ? 0 : -1);

/** חיצים בתוך radiogroup: מעבר ובחירה. ב־RTL, חץ שמאלה = הבא. */
export function radioKeys(e: KeyboardEvent<HTMLElement>) {
  const keys: Record<string, number> = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 };
  if (!(e.key in keys)) return;
  const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]:not(:disabled)'));
  const i = btns.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const next = btns[(i + keys[e.key] + btns.length) % btns.length];
  next.focus();
  next.click();
}

export function Modal({ children, onClose, labelId }: { children: ReactNode; onClose: () => void; labelId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      // מלכודת פוקוס: Tab נשאר בתוך החלון
      const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const wrapTo = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
      if (wrapTo) {
        e.preventDefault();
        wrapTo.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelId} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDelete({
  title,
  body,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} labelId="confirm-title">
      <h3 id="confirm-title">{title}</h3>
      <p className="muted">{body}</p>
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button className="btn danger" onClick={onConfirm}>
          מחיקה לצמיתות
        </button>
        <button className="btn" onClick={onClose} autoFocus>
          ביטול
        </button>
      </div>
    </Modal>
  );
}

export function SectionTitle({ num, children }: { num: string; children: ReactNode }) {
  return (
    <div className="section-title">
      <span className="num">{num}</span>
      <h2 style={{ margin: 0 }}>{children}</h2>
    </div>
  );
}

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' });
