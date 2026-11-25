import type { ImageRecord, Session } from '../types';
import { CHANNELS, activeObservations } from '../data/channels';
import { MINI_IPIP, RIASEC_ITEMS } from '../data/questionnaires';
import { progress } from '../engine/scoring';
import { go, type Route } from '../router';

export type StepState = 'done' | 'partial' | 'todo';

export function stepList(s: Session, images: ImageRecord[]) {
  const ip = progress(MINI_IPIP, s.ipip);
  const ri = progress(RIASEC_ITEMS, s.riasec);
  const qState = (p: { done: number; total: number }): StepState =>
    p.done === p.total ? 'done' : p.done > 0 ? 'partial' : 'todo';
  return [
    ...CHANNELS.map((c) => {
      const hasImg = images.some((i) => i.channel === c.id);
      const manual = activeObservations(s.observations[c.id]).filter((o) => o.source !== 'computed').length;
      const state: StepState = hasImg && manual > 0 ? 'done' : hasImg ? 'partial' : 'todo';
      return { key: c.id, label: c.short, icon: c.icon, state, route: { name: 'channel', id: s.id, channel: c.id } as Route };
    }),
    { key: 'ipip', label: 'אישיות', icon: '◐', state: qState(ip), route: { name: 'quest', id: s.id, which: 'ipip' } as Route },
    { key: 'riasec', label: 'תעסוקה', icon: '⬡', state: qState(ri), route: { name: 'quest', id: s.id, which: 'riasec' } as Route },
    {
      key: 'analyze',
      label: 'ניתוח',
      icon: '⟳',
      state: (s.analyzedAt ? 'done' : 'todo') as StepState,
      route: { name: 'analyze', id: s.id } as Route,
    },
  ];
}

export default function StepNav({ session, images, active }: { session: Session; images: ImageRecord[]; active: string }) {
  const steps = stepList(session, images);
  return (
    <nav className="steps no-print" aria-label="שלבי התהליך">
      <button className={`step-pill ${active === 'hub' ? 'active' : ''}`} onClick={() => go({ name: 'hub', id: session.id })}>
        ☰ סקירה
      </button>
      {steps.map((st) => (
        <button
          key={st.key}
          className={`step-pill ${active === st.key ? 'active' : ''}`}
          onClick={() => go(st.route)}
          aria-current={active === st.key ? 'step' : undefined}
        >
          <span className={`dot ${st.state}`} aria-hidden />
          {st.label}
        </button>
      ))}
    </nav>
  );
}
