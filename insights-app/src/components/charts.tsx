// תרשימים קלים ללא ספריות חיצוניות. צבעים מפורשים (ולא משתני CSS) בתוך ה־SVG
// כדי שייצוא ה־PDF (html2canvas) יציג אותם נכון.
import type { ScaleScore } from '../types';

const BAND_TEXT = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' } as const;

/** פסים אופקיים 1–5, מימין לשמאל, עם סימון אזור ה"בינוני" (2.5–3.5). */
export function ScoreBars<K extends string>({
  scores,
  names,
}: {
  scores: ScaleScore<K>[];
  names: Record<K, string>;
}) {
  return (
    <div className="stack" role="list">
      {scores.map((s) => {
        const pct = s.mean === null ? 0 : ((s.mean - 1) / 4) * 100;
        return (
          <div key={s.key} role="listitem">
            <div className="row spread small">
              <strong>{names[s.key]}</strong>
              <span className="muted">
                {s.mean === null ? `חסר (${s.answered}/${s.total})` : `${s.mean.toFixed(2)} · ${BAND_TEXT[s.band!]}`}
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 14,
                borderRadius: 99,
                background: 'var(--surface-2)',
                overflow: 'hidden',
              }}
              aria-hidden
            >
              <div
                style={{
                  position: 'absolute',
                  insetInlineStart: '37.5%',
                  width: '25%',
                  top: 0,
                  bottom: 0,
                  background: 'rgba(122,127,140,0.18)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  insetInlineStart: 0,
                  width: `${pct}%`,
                  top: 3,
                  bottom: 3,
                  borderRadius: 99,
                  background: '#4f8a8f',
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="row spread tiny muted" aria-hidden>
        <span>1 · נמוך</span>
        <span>אזור ביניים 2.5–3.5</span>
        <span>5 · גבוה</span>
      </div>
    </div>
  );
}

/** תרשים מכ"ם משושה ל־RIASEC (הסדר המעגלי של Holland). */
export function RiasecRadar<K extends string>({ scores, names }: { scores: ScaleScore<K>[]; names: Record<K, string> }) {
  const size = 300;
  const c = size / 2;
  const R = 105;
  const n = scores.length;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const rings = [1, 2, 3, 4, 5];
  const poly = scores
    .map((s, i) => pt(i, s.mean === null ? 0 : ((s.mean - 1) / 4) * R))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{ maxWidth: 340, display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={scores.map((s) => `${names[s.key]}: ${s.mean ?? 'חסר'}`).join(', ')}
    >
      {rings.map((r) => (
        <polygon
          key={r}
          points={scores.map((_, i) => pt(i, ((r - 1) / 4) * R).join(',')).join(' ')}
          fill="none"
          stroke="#9aa0aa"
          strokeOpacity={0.35}
        />
      ))}
      {scores.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#9aa0aa" strokeOpacity={0.35} />;
      })}
      <polygon points={poly} fill="#4f8a8f" fillOpacity={0.28} stroke="#4f8a8f" strokeWidth={2} />
      {scores.map((s, i) => {
        const [x, y] = pt(i, R + 26);
        return (
          <text key={s.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#7a7f8c">
            {names[s.key]}
          </text>
        );
      })}
    </svg>
  );
}
