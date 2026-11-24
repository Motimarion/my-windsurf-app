import type { Synthesis, SynthesisEntry, SynthesisTheme } from '../types';
import { BIG_FIVE_NAMES, RIASEC_NAMES } from '../data/questionnaires';
import { channelById } from '../data/channels';
import { themeById } from '../data/themes';
import { claimById } from '../data/evidence';
import { LevelBadge } from './ui';
import { chanceAtLeast } from '../engine/synthesis';

const BAND = { low: 'נמוך', mid: 'בינוני', high: 'גבוה' } as const;
const BAND_F = { low: 'נמוכה', mid: 'בינונית', high: 'גבוהה' } as const;

function anchorText(t: SynthesisTheme): string {
  if (!t.trait) return '';
  if (t.band === null || t.mean === null) return 'השאלון: הסולם לא חושב';
  // "אינטלקט / דמיון" בלשון זכר; שאר שמות התכונות בלשון נקבה.
  const base = `השאלון: ${BIG_FIVE_NAMES[t.trait]} ${t.trait === 'I' ? BAND[t.band] : BAND_F[t.band]} (${t.mean.toFixed(2)})`;
  if (!t.inverted || t.band === 'mid') return base;
  return `${base} · כלומר יציבות ${t.band === 'low' ? 'גבוהה' : 'נמוכה'}`;
}

const VS: Record<SynthesisEntry['vs'], { cls: string; text: string } | null> = {
  match: { cls: 'accent', text: 'באותו כיוון כמו השאלון' },
  mismatch: { cls: 'trad', text: 'בכיוון ההפוך מהשאלון' },
  neutral: { cls: '', text: 'השאלון באמצע הסולם' },
  na: null,
};

function sourceText(e: SynthesisEntry): string {
  if (e.source === 'ai') return ` · לפי תיאור ${e.model ?? 'מודל AI'}`;
  if (e.source === 'computed') return ' · לפי מדידה אוטומטית';
  if (e.source === 'demo') return ' · ערך הדגמה';
  return '';
}

function Entry({ e, up, down }: { e: SynthesisEntry; up: string; down: string }) {
  const def = channelById(e.channel);
  const vs = VS[e.vs];
  return (
    <li className="synth-entry">
      <span aria-hidden className="synth-icon">
        {def.icon}
      </span>
      <div>
        <div className="small">{e.note.text}</div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          {e.dir !== 0 && (
            <span className="badge">
              {e.dir === 1 ? '↑' : '↓'} {e.dir === 1 ? up : down}
            </span>
          )}
          {vs && <span className={`badge ${vs.cls}`}>{vs.text}</span>}
          <span className="tiny muted">
            {def.short}
            {sourceText(e)}
          </span>
        </div>
      </div>
    </li>
  );
}

const AGREE: Record<SynthesisTheme['agreement'], string> = {
  same: 'הטענות המסורתיות בנושא הזה מסכימות זו עם זו.',
  mixed: 'הטענות המסורתיות בנושא הזה סותרות זו את זו.',
  single: 'טענה מסורתית אחת בלבד בנושא הזה.',
  none: '',
};

export default function SynthesisView({ synthesis: s }: { synthesis: Synthesis }) {
  const anchored = s.themes.filter((t) => t.trait);
  const other = s.themes.find((t) => t.id === 'other')!;
  const chance = s.compared ? Math.round(chanceAtLeast(s.matched, s.compared) * 100) : null;
  const bf = claimById('bf_instrument');
  const heb = claimById('bf_hebrew');

  return (
    <>
      <div className="notice trad">
        <strong className="small">כל המקורות יחד, לפי נושאים</strong>
        <p className="small" style={{ margin: '6px 0 8px' }}>
          השאלון הוא העוגן והמקור היחיד לציונים. לצידו מוצגות הטענות של המסורות על כף היד, כתב היד והציורים שלך, אחרי
          שתרגמנו כל טענה לנושא ולכיוון כדי שאפשר יהיה להשוות. התרגום שלנו, והוא לא ממצא עליך.
        </p>
        <div className="row" style={{ gap: 6 }}>
          {bf && (
            <span className="tiny">
              השאלון: <LevelBadge level={bf.level} />
            </span>
          )}
          {heb && (
            <span className="tiny">
              הנוסח העברי: <LevelBadge level={heb.level} />
            </span>
          )}
          <span className="tiny">
            המסורות: <LevelBadge level="C" /> <LevelBadge level="D" />
          </span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>סיכום השילוב</h3>
        {s.total === 0 ? (
          <p className="small muted">אין בתהליך הזה טענות מסורתיות לשלב: לא הועלו תמונות, או שלא סומנו בהן תצפיות.</p>
        ) : (
          <>
            <p className="small" style={{ marginTop: 0 }}>
              {s.total} טענות מסורתיות מכל הערוצים. {s.compared > 0 ? `${s.compared} מהן הושוו לשאלון: ${s.matched} באותו כיוון, ${s.compared - s.matched} בכיוון ההפוך.` : 'אף אחת מהן לא הושוותה לשאלון.'}
              {s.neutral > 0 && ` ${s.neutral} בנושאים שבהם השאלון באמצע הסולם.`}
              {s.unanchored > 0 && ` ${s.unanchored} בלי מקבילה בשאלון.`}
            </p>
            {chance !== null && (
              <p className="small">
                <strong>
                  בניחוש (הטלת מטבע לכל טענה), לפחות {s.matched} התאמות מתוך {s.compared} היו יוצאות בערך ב־{chance}% מהפעמים.
                </strong>{' '}
                {chance > 5
                  ? 'כלומר, ההתאמה כאן לא חורגת ממה שהיה יוצא במקרה.'
                  : 'זה נדיר במקרה, אבל התאמה אצל אדם אחד עדיין לא מראה תוקף. תוקף בודקים על הרבה אנשים.'}
              </p>
            )}
            <p className="small muted" style={{ marginBottom: 0 }}>
              גם כשמסורת מסכימה עם השאלון, היא לא מוסיפה מידע: המדידה היא השאלון. וכשכמה מסורות מסכימות ביניהן, זה לא מגדיל את
              התוקף שלהן.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-2">
        {anchored.map((t) => {
          const def = themeById(t.id);
          return (
            <div className="card" key={t.id}>
              <h3 style={{ margin: 0 }}>{t.title}</h3>
              <div className="row" style={{ gap: 6, margin: '6px 0' }}>
                <span className="badge ok wrap">{anchorText(t)}</span>
              </div>
              {t.riasec.length > 0 && (
                <p className="tiny muted" style={{ margin: '0 0 6px' }}>
                  תחומי עניין קשורים:{' '}
                  {t.riasec.map((r) => `${RIASEC_NAMES[r.key]} ${r.band ? BAND[r.band] : 'לא חושב'}`).join(' · ')}
                </p>
              )}
              {t.entries.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  אף מסורת לא טענה דבר בנושא הזה על סמך התמונות שלך.
                </p>
              ) : (
                <>
                  <ul className="synth-list">
                    {t.entries.map((e, i) => (
                      <Entry key={`${e.channel}-${e.note.id}-${i}`} e={e} up={def.up} down={def.down} />
                    ))}
                  </ul>
                  {AGREE[t.agreement] && <p className="tiny muted" style={{ margin: '6px 0 0' }}>{AGREE[t.agreement]}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {other.entries.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{other.title}</h3>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            לטענות האלה אין נושא מקביל בשאלון, ולכן אין עם מה להשוות אותן.
          </p>
          <ul className="synth-list">
            {other.entries.map((e, i) => (
              <Entry key={`${e.channel}-${e.note.id}-${i}`} e={e} up="" down="" />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
