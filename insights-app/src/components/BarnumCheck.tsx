import { useId, useMemo } from 'react';
import type { Report, Session } from '../types';
import { barnumReadings, barnumVerdict, ownShownFirst, traitOf } from '../engine/barnum';
import { radioKeys, rovingIndex } from './ui';

type Who = 'own' | 'other';

const VERDICT_TEXT = {
  similar:
    'הציונים קרובים. זה אפקט בארנום: תיאור כללי נשמע אישי, גם כשהוא לא נבנה עליך. זו אחת הסיבות שקריאות מסורתיות מרגישות מדויקות.',
  'own-higher':
    'הקריאה שלך התאימה לך יותר. גם זה לא מוכיח שהמסורות עובדות: אצל אדם אחד הבדל כזה יכול לצאת במקרה. המבחן האמיתי הוא בקבוצה: אם רוב האנשים נותנים לשתי הקריאות ציון דומה, המסורת לא מבחינה בין אנשים.',
  'other-higher':
    'הקריאה החלופית התאימה לך יותר מהקריאה שלך. לפי המסורות זה לא אמור לקרות, ובכל זאת זה נפוץ: תיאורים כלליים מתאימים כמעט לכל אחד (אפקט בארנום).',
} as const;

/**
 * ניסוי קצר לפני הדוח: שתי קריאות מסורתיות, אחת מהתוצרים של המשתמש ואחת מתוצרים שונים.
 * הדירוג נשמר בתהליך, והחשיפה מופיעה רק אחרי ששתיהן דורגו. לא נכלל ב־PDF ובהדפסה.
 */
export default function BarnumCheck({
  session,
  report,
  update,
}: {
  session: Session;
  report: Report;
  update: (fn: (s: Session) => Session) => void;
}) {
  const pair = useMemo(() => barnumReadings(report), [report]);
  const uid = useId();
  const ratings = session.barnum ?? {};

  if (pair.own.length < 2)
    return (
      <div className="card no-print barnum">
        <h2 style={{ marginTop: 0 }}>ניסוי קצר: עד כמה זה מתאר אותך?</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>
          אין מספיק תצפיות מסורתיות לניסוי. כדי להריץ אותו צריך לסמן לפחות שני מאפיינים בערוצי התמונה (כף יד, כתב יד או
          ציורים).
        </p>
      </div>
    );

  const order: Who[] = ownShownFirst(session.id) ? ['own', 'other'] : ['other', 'own'];
  const label = (who: Who) => (order.indexOf(who) === 0 ? 'א' : 'ב');
  const rate = (who: Who, v: number) => update((s) => ({ ...s, barnum: { ...s.barnum, [who]: v } }));
  const done = ratings.own != null && ratings.other != null;

  return (
    <div className="card no-print barnum">
      <h2 style={{ marginTop: 0 }}>ניסוי קצר: עד כמה זה מתאר אותך?</h2>
      <p className="small muted">
        כדאי לעשות את זה לפני שקוראים את הדוח. לפניך שתי קריאות לפי המסורות של כף היד, הכתב והציורים. אחת נבנתה מהתוצרים
        שלך, והשנייה מתוצרים שונים. אחרי שתדרג/י את שתיהן יתגלה איזו מהן שלך.
      </p>
      <div className="grid grid-2">
        {order.map((who, i) => {
          const items = who === 'own' ? pair.own : pair.other;
          const qid = `${uid}-q${i}`;
          const value = ratings[who] ?? 0;
          return (
            <div className="barnum-reading" key={who}>
              <h3 style={{ margin: 0 }}>קריאה {i === 0 ? 'א' : 'ב'}</h3>
              <p className="small muted" style={{ margin: '4px 0' }}>
                לפי המסורות, בולטים אצלך:
              </p>
              <ul className="small">
                {items.map((t) => (
                  <li key={t.id}>{traitOf(t)}</li>
                ))}
              </ul>
              <div className="small" id={qid}>
                עד כמה זה מתאר אותך? (1 = בכלל לא, 5 = מאוד)
              </div>
              <div className="likert" role="radiogroup" aria-labelledby={qid} onKeyDown={radioKeys}>
                {[1, 2, 3, 4, 5].map((v, j) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={value === v}
                    tabIndex={rovingIndex(j, value - 1)}
                    className={value === v ? 'on' : ''}
                    onClick={() => rate(who, v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <div className="notice info" style={{ marginTop: 14 }} role="status">
          <p className="small" style={{ marginTop: 0 }}>
            <strong>קריאה {label('own')} נבנתה מהתוצרים שלך.</strong> קריאה {label('other')} נבנתה מתוצרים שונים: זה מה
            שהמסורות היו אומרות אילו כף היד, הכתב או הציורים נראו אחרת.
          </p>
          <p className="small">
            נתת {ratings.own} לקריאה שלך ו־{ratings.other} לקריאה החלופית. {VERDICT_TEXT[barnumVerdict(ratings.own!, ratings.other!)]}
          </p>
          <p className="small" style={{ marginBottom: 0 }}>
            לדיון בכיתה: כמה מכם נתנו לשתי הקריאות ציון דומה?
          </p>
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => update((s) => ({ ...s, barnum: undefined }))}>
            דירוג מחדש
          </button>
        </div>
      )}
    </div>
  );
}
