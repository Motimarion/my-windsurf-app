import type { ResearchClaim, Source, EvidenceLevel } from '../types';

/**
 * שכבה ב׳ — מאגר המחקר.
 * כל מקור מסומן אם אומת מול מאגר אקדמי (Consensus) בסשן הפיתוח,
 * או שנרשם מידיעה קודמת וממתין לאימות ביבליוגרפי מלא.
 * אין לשנות דירוג ראיות ללא מקור ונימוק — כל שינוי נרשם ב־docs/DECISIONS.md.
 */
export const SOURCES: Source[] = [
  {
    id: 'donnellan2006',
    citation:
      'Donnellan, M. B., Oswald, F. L., Baird, B. M., & Lucas, R. E. (2006). The Mini-IPIP Scales: Tiny-yet-effective measures of the Big Five factors of personality. Psychological Assessment, 18(2), 192–203.',
    year: 2006,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:13db3dd1-d12d-4f46-b62a-eb597ca8f16a/',
  },
  {
    id: 'baldasaro2012',
    citation:
      'Baldasaro, R. E., Shanahan, M. J., & Bauer, D. J. (2012). Psychometric properties of the Mini-IPIP in a large, nationally representative sample of young adults. Journal of Personality Assessment.',
    year: 2012,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:5c397c34-20d3-442e-9540-d42a7afefb83/',
  },
  {
    id: 'neter1989',
    citation:
      'Neter, E., & Ben-Shakhar, G. (1989). The predictive validity of graphological inferences: A meta-analytic approach. Personality and Individual Differences, 10(7), 737–745.',
    year: 1989,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:f4cdd5de-9bbd-4e96-94a0-bcaf2ab2efaa/',
  },
  {
    id: 'benshakhar1986',
    citation:
      'Ben-Shakhar, G., Bar-Hillel, M., Bilu, Y., Ben-Abba, E., & Flug, A. (1986). Can graphology predict occupational success? Two empirical studies and some methodological ruminations. Journal of Applied Psychology, 71(4), 645–653.',
    year: 1986,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:9de963fb-e4c5-4729-af5d-63b586ddaaaa/',
  },
  {
    id: 'king2000',
    citation:
      'King, R. N., & Koehler, D. J. (2000). Illusory correlations in graphological inference. Journal of Experimental Psychology: Applied, 6(4), 336–348.',
    year: 2000,
    verification: 'pending',
  },
  {
    id: 'lilienfeld2000',
    citation:
      'Lilienfeld, S. O., Wood, J. M., & Garb, H. N. (2000). The scientific status of projective techniques. Psychological Science in the Public Interest, 1(2), 27–66.',
    year: 2000,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:6d843d7a-5c58-49a3-a30b-f508ba502230/',
  },
  {
    id: 'taylor2015',
    citation: 'Taylor, W. D., et al. (2015). Human Figure Drawings. In The Encyclopedia of Clinical Psychology. Wiley.',
    year: 2015,
    verification: 'verified-db',
    url: 'https://consensus.app/papers/details/w:83333903-689e-43c1-b976-cc7a1ffc400b/',
  },
  {
    id: 'barrick2003',
    citation:
      "Barrick, M. R., Mount, M. K., & Gupta, R. (2003). Meta-analysis of the relationship between the five-factor model of personality and Holland's occupational types. Personnel Psychology, 56(1), 45–74.",
    year: 2003,
    verification: 'pending',
  },
  {
    id: 'holland1997',
    citation:
      'Holland, J. L. (1997). Making vocational choices: A theory of vocational personalities and work environments (3rd ed.). Psychological Assessment Resources.',
    year: 1997,
    verification: 'pending',
  },
  {
    id: 'armstrong2008',
    citation:
      'Armstrong, P. I., Allison, W., & Rounds, J. (2008). Development and initial validation of brief public domain RIASEC marker scales. Journal of Vocational Behavior, 73(2), 287–299.',
    year: 2008,
    verification: 'pending',
  },
  {
    id: 'koch1952',
    citation: 'Koch, K. (1952). Der Baumtest (2nd ed.). Bern: Huber. — מקור מסורתי, לא מחקר תיקוף.',
    year: 1952,
    verification: 'pending',
  },
  {
    id: 'buck1948',
    citation: 'Buck, J. N. (1948). The H-T-P technique. Journal of Clinical Psychology, 4(4), 317–396. — מקור מסורתי, לא מחקר תיקוף.',
    year: 1948,
    verification: 'pending',
  },
  {
    id: 'machover1949',
    citation: 'Machover, K. (1949). Personality projection in the drawing of the human figure. Springfield, IL: Thomas. — מקור מסורתי, לא מחקר תיקוף.',
    year: 1949,
    verification: 'pending',
  },
];

export const CLAIMS: ResearchClaim[] = [
  {
    id: 'bf_instrument',
    domain: 'bigfive',
    statement:
      'Mini-IPIP (20 פריטים) הראה מהימנות פנימית מקובלת ודפוסי תוקף מתכנס דומים לכלים ארוכים יותר למדידת חמש התכונות הרחבות.',
    level: 'A',
    sourceIds: ['donnellan2006', 'baldasaro2012'],
  },
  {
    id: 'bf_hebrew',
    domain: 'bigfive',
    statement:
      'הנוסח העברי בגרסה זו הוא תרגום עבודה שלא עבר תיקוף (תרגום־חוזר, ניתוח גורמים, נורמות ישראליות). אין נורמות — הציונים מוצגים כממוצעים גולמיים בלבד.',
    level: 'D',
    sourceIds: [],
  },
  {
    id: 'riasec_model',
    domain: 'riasec',
    statement: 'מודל RIASEC של Holland הוא מודל נחקר ומבוסס לתיאור תחומי עניין תעסוקתיים.',
    level: 'A',
    sourceIds: ['holland1997', 'armstrong2008'],
  },
  {
    id: 'riasec_items',
    domain: 'riasec',
    statement:
      'פריטי ה־RIASEC בגרסה זו הם פריטי הדגמה מקוריים שלא תוקפו. יש להחליפם בכלי מתוקף לפני שימוש מחקרי.',
    level: 'D',
    sourceIds: [],
  },
  {
    id: 'integ_bf_riasec',
    domain: 'integration',
    statement:
      'מטא־אנליזה מצאה קשרים בעוצמה בינונית לכל היותר בין תכונות Big Five לטיפוסי Holland — בעיקר מוחצנות–יזמי ומוחצנות–חברתי, פתיחות–אמנותי ופתיחות–חקרני; קשרים חלשים יותר לנעימות–חברתי ולמצפוניות–מנהלי.',
    level: 'A',
    sourceIds: ['barrick2003'],
  },
  {
    id: 'hw_personality',
    domain: 'handwriting',
    statement:
      'הסקת תכונות אישיות או הצלחה תעסוקתית מכתב יד: כאשר תוכן הטקסט מנוטרל, התוקף של גרפולוגים קרוב לאפס, ופסיכולוגים ללא ידע בגרפולוגיה הצליחו לא פחות.',
    level: 'C',
    sourceIds: ['neter1989', 'benshakhar1986'],
  },
  {
    id: 'hw_illusory',
    domain: 'handwriting',
    statement: 'חלק מהאמון בגרפולוגיה מוסבר בהטיית "מתאם מדומה" — קשרים אינטואיטיביים בין צורת הכתב לתכונה.',
    level: 'B',
    sourceIds: ['king2000'],
  },
  {
    id: 'drawing_signs',
    domain: 'drawing',
    statement:
      'פרשנות "סימנים" בציורי דמות, בית ועץ כמדד לאישיות או למצב רגשי: התמיכה האמפירית מוגבלת מאוד, ולרוב הסימנים אין תוקף משוכפל.',
    level: 'C',
    sourceIds: ['lilienfeld2000', 'taylor2015'],
  },
  {
    id: 'palm_lines',
    domain: 'palm',
    statement:
      'לא אותר מחקר מבוקר שפורסם בכתב עת שפיט ותומך בקשר בין קווי כף היד לבין אישיות, יכולות או עתיד. הפרשנויות הן מסורת בלבד.',
    level: 'D',
    sourceIds: [],
  },
];

export const LEVEL_LABELS: Record<EvidenceLevel, { short: string; long: string }> = {
  A: { short: 'ראיות מבוססות', long: 'ראיות עקביות ומשוכפלות (מטא־אנליזות / תיקוף פסיכומטרי)' },
  B: { short: 'ראיות חלקיות', long: 'ראיות חלקיות, מעורבות או אפקטים קטנים' },
  C: { short: 'אין תמיכה', long: 'נחקר — והמחקר אינו תומך בטענה' },
  D: { short: 'לא נחקר / מסורת', long: 'אין מחקר אמפירי ידוע; מסורת או טענה בלבד' },
};

export const claimById = (id: string) => CLAIMS.find((c) => c.id === id);
export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
