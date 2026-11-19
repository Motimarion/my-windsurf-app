import { useEffect, type ReactNode } from 'react';
import type { CheckStatus, EvidenceLevel } from '../types';
import { LEVEL_LABELS } from '../data/evidence';

const STATUS_TEXT: Record<CheckStatus, string> = { ok: 'תקין', warn: 'אזהרה', fail: 'נכשל' };
const STATUS_ICON: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✕' };

export function StatusBadge({ status, label }: { status: CheckStatus; label?: string }) {
  return (
    <span className={`badge ${status}`} aria-label={STATUS_TEXT[status]}>
      <span aria-hidden>{STATUS_ICON[status]}</span> {label ?? STATUS_TEXT[status]}
    </span>
  );
}

export function LevelBadge({ level }: { level: EvidenceLevel }) {
  return (
    <span className={`badge lv${level}`} title={LEVEL_LABELS[level].long}>
      רמה {level} · {LEVEL_LABELS[level].short}
    </span>
  );
}

export function Progress({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <span style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
    <Modal onClose={onClose}>
      <h3>{title}</h3>
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
