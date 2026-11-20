import type { ChannelId, TraditionNote } from '../types';

export interface FeatureDef {
  id: string;
  label: string;
  options: string[];
  /** מאפיין שמחושב אוטומטית מהפיקסלים (ולא מסומן ידנית). */
  computed?: boolean;
}

export interface ChannelDef {
  id: ChannelId;
  title: string;
  short: string;
  icon: string;
  kind: 'palm' | 'handwriting' | 'drawing';
  instructions: string[];
  features: FeatureDef[];
}

const UNKNOWN = 'לא ניתן לזהות';

const PALM_FEATURES: FeatureDef[] = [
  { id: 'palm.lineClarity', label: 'בהירות הקווים הראשיים בתמונה', options: ['ברורים', 'בינוניים', 'חלשים'] },
  {
    id: 'palm.heartLineEnd',
    label: 'נקודת הסיום של הקו העליון (״קו הלב״)',
    options: ['מתחת לאצבע המורה', 'בין המורה לאמה', 'מתחת לאמה', UNKNOWN],
  },
  { id: 'palm.headLineShape', label: 'צורת הקו האמצעי (״קו הראש״)', options: ['ישר', 'מעוקל', UNKNOWN] },
  { id: 'palm.lifeLineArc', label: 'קשת הקו המקיף את בסיס האגודל (״קו החיים״)', options: ['רחבה', 'צרה', UNKNOWN] },
];

const PALM_INSTRUCTIONS = [
  'צלמו באור יום רך או בתאורה אחידה, בלי פלאש ישיר.',
  'כף היד פתוחה ושטוחה, האצבעות צמודות קלות, על רקע חלק ובהיר.',
  'המצלמה מקבילה לכף היד, במרחק של כ־25–30 ס״מ — כל כף היד בתוך המסגרת.',
  'ודאו שהקווים נראים בבירור בתמונה לפני ההעלאה.',
];

const DRAWING_COMPUTED: FeatureDef[] = [
  { id: 'drawing.size', label: 'גודל הציור ביחס לדף (מחושב)', options: ['קטן', 'בינוני', 'גדול'], computed: true },
  {
    id: 'drawing.placement',
    label: 'מיקום הציור על הדף (מחושב)',
    options: ['מרכז', 'צד ימין', 'צד שמאל', 'חלק עליון', 'חלק תחתון'],
    computed: true,
  },
];

const DRAWING_INSTRUCTIONS = (what: string) => [
  `ציירו ${what} בעיפרון על דף A4 לבן, ללא מחק אם אפשר.`,
  'אין ״נכון״ או ״לא נכון״ — ציירו בדרך שנוחה לכם.',
  'צלמו את הדף כולו מלמעלה, מקביל לשולחן, בתאורה אחידה וללא צל.',
  'ודאו שארבע פינות הדף נראות בתמונה.',
];

export const CHANNELS: ChannelDef[] = [
  {
    id: 'palmRight',
    title: 'כף יד ימין',
    short: 'יד ימין',
    icon: '✋',
    kind: 'palm',
    instructions: PALM_INSTRUCTIONS,
    features: PALM_FEATURES,
  },
  {
    id: 'palmLeft',
    title: 'כף יד שמאל',
    short: 'יד שמאל',
    icon: '🤚',
    kind: 'palm',
    instructions: PALM_INSTRUCTIONS,
    features: PALM_FEATURES,
  },
  {
    id: 'handwriting',
    title: 'דוגמת כתב יד בעברית',
    short: 'כתב יד',
    icon: '✍️',
    kind: 'handwriting',
    instructions: [
      'כתבו 5–8 שורות בעברית, בכתב רגיל, על דף לבן ללא שורות.',
      'מומלץ להעתיק טקסט ניטרלי (למשל מתכון), בלי שמות ובלי פרטים מזהים — תוכן אישי עלול להשפיע על הפרשנות.',
      'השתמשו בעט כחול או שחור.',
      'צלמו מלמעלה, כל הדף בתוך המסגרת, בלי צל.',
    ],
    features: [
      { id: 'hw.lines', label: 'מספר שורות (מחושב)', options: ['1–3', '4–8', '9+'], computed: true },
      { id: 'hw.slant', label: 'נטיית האותיות', options: ['קדימה (בכיוון הכתיבה)', 'זקופה', 'אחורה', 'משתנה'] },
      { id: 'hw.size', label: 'גודל האותיות', options: ['קטן', 'בינוני', 'גדול'] },
      { id: 'hw.spacing', label: 'מרווח בין מילים', options: ['צפוף', 'בינוני', 'מרווח'] },
      { id: 'hw.baseline', label: 'קו הבסיס של השורות', options: ['עולה', 'ישר', 'יורד', 'גלי'] },
      { id: 'hw.pressure', label: 'לחץ העט כפי שנראה בתמונה', options: ['חלש', 'בינוני', 'חזק', UNKNOWN] },
    ],
  },
  {
    id: 'drawingTree',
    title: 'ציור עץ',
    short: 'עץ',
    icon: '🌳',
    kind: 'drawing',
    instructions: DRAWING_INSTRUCTIONS('עץ'),
    features: [
      ...DRAWING_COMPUTED,
      { id: 'tree.roots', label: 'שורשים', options: ['מצוירים', 'לא מצוירים'] },
      { id: 'tree.crown', label: 'צורת הצמרת', options: ['מעוגלת / ענן', 'ענפים פתוחים', 'מחודדת', 'אחר'] },
      { id: 'tree.trunk', label: 'עובי הגזע', options: ['דק', 'בינוני', 'עבה'] },
      { id: 'tree.fruit', label: 'פירות או פרחים', options: ['מצוירים', 'לא מצוירים'] },
      { id: 'tree.ground', label: 'קו קרקע', options: ['מצויר', 'לא מצויר'] },
    ],
  },
  {
    id: 'drawingPerson',
    title: 'ציור אדם',
    short: 'אדם',
    icon: '🧍',
    kind: 'drawing',
    instructions: DRAWING_INSTRUCTIONS('אדם שלם'),
    features: [
      ...DRAWING_COMPUTED,
      { id: 'person.completeness', label: 'שלמות הדמות', options: ['דמות מלאה', 'דמות חלקית', 'ראש בלבד'] },
      { id: 'person.style', label: 'סגנון', options: ['מציאותי', 'סכמטי (קווים)', 'מופשט'] },
      { id: 'person.face', label: 'פרטי פנים', options: ['מלאים', 'חלקיים', 'ללא'] },
      { id: 'person.hands', label: 'ידיים', options: ['גלויות', 'מוסתרות', 'חסרות'] },
    ],
  },
];

export const channelById = (id: ChannelId) => CHANNELS.find((c) => c.id === id)!;

/**
 * שכבה ג׳ — פרשנויות מסורתיות.
 * כל רשומה מנוסחת כ״במסורת נטען ש...״ ומקושרת לטענה בשכבה ב׳ שמדרגת את הראיות.
 * המערכת לעולם לא מציגה טקסטים אלה כממצא על האדם.
 */
const T = (
  channel: TraditionNote['channel'],
  featureId: string,
  value: string,
  tradition: string,
  text: string,
  claimId: string,
): TraditionNote => ({ id: `${featureId}=${value}`, channel, featureId, value, tradition, text, claimId });

const PALM = 'כירומנטיה (קריאה בכף היד)';
const GRAPH = 'גרפולוגיה קלאסית';
const KOCH = 'מבחן העץ (Koch, 1949)';
const HTP = 'בית־עץ־אדם (Buck, 1948) / ציור דמות (Machover, 1949)';

export const TRADITIONS: TraditionNote[] = [
  T('palm', 'palm.heartLineEnd', 'בין המורה לאמה', PALM, 'במסורת נטען שסיום ״קו הלב״ בין המורה לאמה מבטא איזון בין רגש לשיקול דעת.', 'palm_lines'),
  T('palm', 'palm.heartLineEnd', 'מתחת לאצבע המורה', PALM, 'במסורת נטען שסיום ״קו הלב״ מתחת לאצבע המורה מבטא אידיאליזם ברגש.', 'palm_lines'),
  T('palm', 'palm.heartLineEnd', 'מתחת לאמה', PALM, 'במסורת נטען שסיום ״קו הלב״ מתחת לאמה מבטא גישה מעשית ליחסים.', 'palm_lines'),
  T('palm', 'palm.headLineShape', 'מעוקל', PALM, 'במסורת נטען ש״קו ראש״ מעוקל מבטא דמיון ויצירתיות.', 'palm_lines'),
  T('palm', 'palm.headLineShape', 'ישר', PALM, 'במסורת נטען ש״קו ראש״ ישר מבטא חשיבה מעשית ושיטתית.', 'palm_lines'),
  T('palm', 'palm.lifeLineArc', 'רחבה', PALM, 'במסורת נטען שקשת רחבה של ״קו החיים״ מבטאת חיוניות. (גם במסורת עצמה — אין קשר לאורך החיים.)', 'palm_lines'),
  T('palm', 'palm.lifeLineArc', 'צרה', PALM, 'במסורת נטען שקשת צרה של ״קו החיים״ מבטאת זהירות ושמירת אנרגיה.', 'palm_lines'),

  T('handwriting', 'hw.slant', 'קדימה (בכיוון הכתיבה)', GRAPH, 'בגרפולוגיה נטען שנטייה קדימה מבטאת פנייה לזולת והבעה רגשית.', 'hw_personality'),
  T('handwriting', 'hw.slant', 'זקופה', GRAPH, 'בגרפולוגיה נטען שכתב זקוף מבטא שליטה עצמית ואיפוק.', 'hw_personality'),
  T('handwriting', 'hw.slant', 'אחורה', GRAPH, 'בגרפולוגיה נטען שנטייה לאחור מבטאת הסתייגות או זהירות חברתית.', 'hw_personality'),
  T('handwriting', 'hw.size', 'גדול', GRAPH, 'בגרפולוגיה נטען שכתב גדול מבטא ביטחון עצמי וצורך בנראות.', 'hw_personality'),
  T('handwriting', 'hw.size', 'קטן', GRAPH, 'בגרפולוגיה נטען שכתב קטן מבטא ריכוז ותשומת לב לפרטים.', 'hw_personality'),
  T('handwriting', 'hw.baseline', 'עולה', GRAPH, 'בגרפולוגיה נטען שקו בסיס עולה מבטא אופטימיות.', 'hw_personality'),
  T('handwriting', 'hw.baseline', 'יורד', GRAPH, 'בגרפולוגיה נטען שקו בסיס יורד מבטא עייפות. (בפועל — זווית הדף והצילום משפיעות מאוד.)', 'hw_personality'),
  T('handwriting', 'hw.spacing', 'מרווח', GRAPH, 'בגרפולוגיה נטען שמרווחים גדולים בין מילים מבטאים צורך במרחב אישי.', 'hw_personality'),
  T('handwriting', 'hw.pressure', 'חזק', GRAPH, 'בגרפולוגיה נטען שלחץ חזק מבטא אנרגיה ונחישות.', 'hw_personality'),

  T('drawingTree', 'tree.roots', 'מצוירים', KOCH, 'במבחן העץ נטען ששורשים מבטאים צורך בביסוס ובקשר לעבר.', 'drawing_signs'),
  T('drawingTree', 'tree.fruit', 'מצוירים', KOCH, 'במבחן העץ נטען שפירות מבטאים הישגיות או תחושת פוריות.', 'drawing_signs'),
  T('drawingTree', 'tree.trunk', 'עבה', KOCH, 'במבחן העץ נטען שגזע עבה מבטא תחושת כוח ויציבות.', 'drawing_signs'),
  T('drawingTree', 'tree.trunk', 'דק', KOCH, 'במבחן העץ נטען שגזע דק מבטא רגישות.', 'drawing_signs'),
  T('drawingTree', 'tree.crown', 'ענפים פתוחים', KOCH, 'במבחן העץ נטען שענפים פתוחים מבטאים פתיחות לסביבה.', 'drawing_signs'),
  T('drawingTree', 'drawing.size', 'קטן', HTP, 'במסורת הציורים ההשלכתיים נטען שציור קטן מבטא חוסר ביטחון.', 'drawing_signs'),
  T('drawingTree', 'drawing.size', 'גדול', HTP, 'במסורת הציורים ההשלכתיים נטען שציור גדול מבטא ביטחון או התפשטות.', 'drawing_signs'),
  T('drawingTree', 'drawing.placement', 'צד שמאל', HTP, 'ב־HTP נטען שמיקום בצד שמאל של הדף מבטא התמקדות בעבר.', 'drawing_signs'),
  T('drawingTree', 'drawing.placement', 'צד ימין', HTP, 'ב־HTP נטען שמיקום בצד ימין של הדף מבטא התמקדות בעתיד.', 'drawing_signs'),

  T('drawingPerson', 'person.hands', 'מוסתרות', HTP, 'בפרשנות ציור הדמות נטען שידיים מוסתרות מבטאות קושי ביצירת קשר.', 'drawing_signs'),
  T('drawingPerson', 'person.face', 'ללא', HTP, 'בפרשנות ציור הדמות נטען שהיעדר פרטי פנים מבטא ריחוק חברתי.', 'drawing_signs'),
  T('drawingPerson', 'person.completeness', 'ראש בלבד', HTP, 'בפרשנות ציור הדמות נטען שציור ראש בלבד מבטא התמקדות אינטלקטואלית.', 'drawing_signs'),
  T('drawingPerson', 'drawing.size', 'קטן', HTP, 'במסורת הציורים ההשלכתיים נטען שדמות קטנה מבטאת חוסר ביטחון.', 'drawing_signs'),
  T('drawingPerson', 'drawing.size', 'גדול', HTP, 'במסורת הציורים ההשלכתיים נטען שדמות גדולה מבטאת ביטחון או התפשטות.', 'drawing_signs'),
];

export const traditionsFor = (channel: ChannelId, featureId: string, value: string) =>
  TRADITIONS.filter(
    (t) =>
      (t.channel === channel || (t.channel === 'palm' && channel.startsWith('palm'))) &&
      t.featureId === featureId &&
      t.value === value,
  );
