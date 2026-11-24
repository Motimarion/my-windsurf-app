import type { ResearchClaim } from '../types';
import { LEVELS, LEVEL_LABELS, LEVEL_MEANING, levelExamples } from '../data/evidence';
import { LevelBadge } from './ui';

const shorten = (s: string, max = 120) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

/** מקרא רמות הראיות בראש הדוח: מה כל רמה אומרת, ודוגמה לטענה באותה רמה מתוך הדוח הזה. */
export default function LevelLegend({ claims }: { claims: ResearchClaim[] }) {
  const examples = levelExamples(claims);
  return (
    <div className="card level-legend">
      <h3 style={{ marginTop: 0 }}>איך לקרוא את רמות הראיות בדוח</h3>
      <p className="small muted">
        ליד כל טענה בדוח יש תג שמראה כמה המחקר תומך בה. התג לא אומר אם הטענה נכונה לגביך. לחיצה על תג פותחת הסבר קצר.
      </p>
      <ul className="legend-list">
        {LEVELS.map((l) => (
          <li key={l}>
            <LevelBadge level={l} />
            <div>
              <div className="small">
                {LEVEL_LABELS[l].long}. {LEVEL_MEANING[l]}
              </div>
              {examples[l] && <div className="tiny muted">דוגמה מהדוח: {shorten(examples[l]!.statement)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
