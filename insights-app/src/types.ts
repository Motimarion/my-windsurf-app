// מודל הנתונים המרכזי של המערכת.
// כל טיפוס כאן מתאים לשכבה אחת בארכיטקטורה (א׳–ו׳), כך שאפשר לעקוב
// מאיזו שכבה הגיע כל פריט מידע בדוח.

export type ChannelId =
  | 'palmLeft'
  | 'palmRight'
  | 'handwriting'
  | 'drawingTree'
  | 'drawingPerson';

export type CheckStatus = 'ok' | 'warn' | 'fail';

/** תוצאת בדיקת איכות תמונה (שכבה א׳ — מדידה טכנית, לא פרשנות). */
export interface QualityReport {
  width: number;
  height: number;
  brightness: number; // ממוצע בהירות 0–255
  contrast: number; // סטיית תקן של הבהירות
  sharpness: number; // שונות לפלסיאן — מדד חדות
  checks: { id: string; label: string; status: CheckStatus; detail: string }[];
  overall: CheckStatus;
}

/** מאפיינים חזותיים שחושבו אוטומטית מהפיקסלים (שכבה א׳). */
export interface ComputedFeatures {
  inkCoverage: number; // שיעור הפיקסלים הכהים 0–1
  bboxAreaRatio: number; // שטח המסגרת התוחמת של הסימון ביחס לדף 0–1
  centerX: number; // מרכז כובד אופקי 0 (שמאל) – 1 (ימין)
  centerY: number; // מרכז כובד אנכי 0 (למעלה) – 1 (למטה)
  textLines?: number; // לכתב יד בלבד: מספר שורות משוער לפי פרופיל הקרנה
}

export interface ImageRecord {
  id: string;
  sessionId: string;
  channel: ChannelId;
  blob: Blob;
  mime: string;
  quality: QualityReport;
  computed?: ComputedFeatures;
  createdAt: number;
}

/** סיבה לכך שאי אפשר לקבוע מאפיין בודד מהתמונה. דיווח של אדם או של המודל, לא מדידה. */
export type BlockReason = 'תאורה' | 'טשטוש' | 'הסתרה' | 'זווית' | 'אחר';

/** ביטחון שהמודל דיווח עליו בעצמו. לא מכויל, ואינו איכות התמונה ואינו חוזק ראיות. */
export type ModelConfidence = 'גבוה' | 'בינוני' | 'נמוך';

/** תצפית מובנית אחת — מה רואים, לא מה זה "אומר". */
export interface Observation {
  featureId: string;
  value: string;
  source: 'manual' | 'computed' | 'demo' | 'ai';
  /** לערכי AI בלבד: שם המודל שהמשתמש העביר אליו את הבקשה (Gemini, ChatGPT…). */
  model?: string;
  /** כשהערך הוא "לא ניתן לקבוע": מה חסם את הקביעה. */
  blockedBy?: BlockReason;
  /** לערכי AI בלבד: הביטחון שהמודל דיווח עליו. */
  confidence?: ModelConfidence;
}

/**
 * שאלות רקע (רשות). מוצגות בדוח כהקשר בלבד: לא משמשות לאבחון, לא משנות ציונים ולא בוחרות פרשנות.
 */
export interface Background {
  /** היד הדומיננטית (לערוצי כף היד). */
  dominantHand?: 'ימין' | 'שמאל' | 'שתיהן';
  /** היד שכתבה את דוגמת הכתב. */
  writingHand?: 'ימין' | 'שמאל';
  /** האם דוגמת הכתב הועתקה מטקסט או נכתבה חופשי. */
  handwritingSource?: 'הועתק מטקסט' | 'כתיבה חופשית';
  /** זמן משוער לכל ציור. */
  treeMinutes?: DrawingTime;
  personMinutes?: DrawingTime;
  /** ניסיון בציור. */
  drawingExperience?: 'כמעט אין' | 'מצייר/ת לפעמים' | 'מצייר/ת הרבה או למדתי ציור';
}

export type DrawingTime = 'עד 2 דקות' | '2–5 דקות' | 'יותר מ־5 דקות';

/**
 * תיעוד הרצה אחת של תחנת המנוע דרך "הגשר הידני":
 * הקוד הרכיב בקשה, המשתמש העביר אותה למודל, והתשובה עברה בשער הרשימה הסגורה.
 */
export interface AiRun {
  channel: ChannelId;
  model: string;
  at: number;
  /** כמה ערכים עברו בשער וכמה נדחו. */
  accepted: number;
  rejected: number;
  /** האם התשובה כללה טקסט מחוץ ל־JSON (פרשנות וכדומה) — השער מתעלם ממנו. */
  extraText: boolean;
  /** השוואה לסימון הידני: בכמה מאפיינים המודל והאדם בחרו אותו ערך. */
  agreement: { agree: number; compared: number };
  /** האם המשתמש אימץ את ערכי המודל לתצפיות שבדוח. */
  adopted: boolean;
  /** ידני (גשר) או אוטומטי (API עם מפתח אישי). */
  mode?: 'manual' | 'auto';
  /** התמונה שתוארה — כדי שלא תישלח פעמיים. */
  imageId?: string;
  /** הערכים שעברו בשער ומה נדחה — נשמרים כדי להציג את ההשוואה גם אחרי רענון. */
  values?: Observation[];
  rejectedItems?: { featureId: string; value: string; reason: string }[];
  imageUsable?: boolean;
}

export type LikertAnswers = Record<string, number>; // מזהה פריט → 1..5

export interface ConsentRecord {
  version: string;
  acceptedAt: number;
  items: string[];
}

export interface Session {
  id: string;
  label: string;
  /** שאלת הפנייה: מה הנבדק ביקש לבדוק (רשות, טקסט קצר). */
  referral?: string;
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
  consent: ConsentRecord | null;
  ipip: LikertAnswers;
  riasec: LikertAnswers;
  observations: Partial<Record<ChannelId, Observation[]>>;
  /** הרצות של תחנת המנוע (AI) דרך הגשר הידני. שדה אופציונלי — תהליכים ישנים לא כוללים אותו. */
  aiRuns?: AiRun[];
  analyzedAt?: number;
  /** ניסוי בארנום בדוח: הדירוג (1–5) של הקריאה שנבנתה מהתוצרים של המשתמש ושל הקריאה החלופית. אופציונלי. */
  barnum?: { own?: number; other?: number };
  /** תשובות לשאלה לחשיבה ("אילו הסברים אחרים מתאימים?") לפי ערוץ. חלק מהלמידה, לא מהדוח. אופציונלי. */
  reflections?: Partial<Record<ChannelId, string>>;
  /** שאלות רקע (רשות). הקשר בלבד — לא לאבחון ולא לציונים. אופציונלי. */
  background?: Background;
}

// ---------- שכבה ב׳ — מאגר מחקר ----------

/**
 * סולם ראיות של המערכת:
 * A — ראיות מחקריות עקביות ומשוכפלות (מטא־אנליזות/תיקוף פסיכומטרי).
 * B — ראיות חלקיות, מעורבות או אפקטים קטנים.
 * C — מחקר קיים ואינו תומך בטענה (או מצביע על תוקף קרוב לאפס).
 * D — אין מחקר אמפירי ידוע; מסורת או טענה בלבד.
 */
export type EvidenceLevel = 'A' | 'B' | 'C' | 'D';

export interface Source {
  id: string;
  citation: string;
  year: number;
  /** האם המקור אומת בסשן זה מול מאגר אקדמי (Consensus) או נרשם מהזיכרון וממתין לאימות. */
  verification: 'verified-db' | 'pending';
  url?: string;
}

export interface ResearchClaim {
  id: string;
  domain: 'palm' | 'handwriting' | 'drawing' | 'bigfive' | 'riasec' | 'integration';
  statement: string;
  level: EvidenceLevel;
  sourceIds: string[];
}

// ---------- שכבה ג׳ — פרשנויות מסורתיות ----------

export interface TraditionNote {
  id: string;
  channel: ChannelId | 'palm';
  featureId: string;
  value: string;
  tradition: string; // שם המסורת (למשל "גרפולוגיה קלאסית")
  text: string; // ניסוח "במסורת נטען ש..." בלבד
  claimId: string; // קישור חובה לטענה בשכבה ב׳ — לבדיקת עקיבות
}

// ---------- שכבה ד׳ — שאלונים ----------

export type BigFiveTrait = 'E' | 'A' | 'C' | 'N' | 'I';
export type RiasecType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export interface ScaleScore<K extends string> {
  key: K;
  mean: number | null; // 1..5, null אם חסרים פריטים
  answered: number;
  total: number;
  band: 'low' | 'mid' | 'high' | null;
}

// ---------- שכבה ה׳ — אינטגרציה ----------

export interface IntegrationNote {
  id: string;
  kind: 'consistent' | 'divergent' | 'info';
  text: string;
  claimId: string;
}

export interface ReflectionPrompt {
  id: string;
  text: string;
}

// ---------- שכבה ו׳ — בקרת איכות ----------

export interface QACheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

// ---------- שלב השילוב — כל המקורות לפי נושאים ----------

export type ThemeId = 'extraversion' | 'warmth' | 'order' | 'stability' | 'imagination' | 'other';

/** כיוון: 1 = כלפי מעלה בנושא, ‎-1 = כלפי מטה, 0 = אמצע הסולם או בלי כיוון. */
export type Direction = 1 | -1 | 0;

/** השוואה של טענה מסורתית לשאלון: באותו כיוון, בכיוון הפוך, שאלון באמצע, או אין עם מה להשוות. */
export type VsQuestionnaire = 'match' | 'mismatch' | 'neutral' | 'na';

export interface SynthesisEntry {
  channel: ChannelId;
  note: TraditionNote;
  dir: Direction;
  vs: VsQuestionnaire;
  /** מי תיאר את המאפיין שהמסורת נשענת עליו: אדם, חישוב, מודל AI או הדגמה. */
  source?: Observation['source'];
  model?: string;
}

export interface SynthesisTheme {
  id: ThemeId;
  title: string;
  trait?: BigFiveTrait;
  inverted?: boolean;
  /** העוגן המדוד: הציון בשאלון. null כשאין לנושא עוגן או שהסולם לא חושב. */
  band: ScaleScore<BigFiveTrait>['band'];
  mean: number | null;
  /** כיוון השאלון בנושא (אחרי היפוך לנוירוטיות). null כשאין ציון. */
  dir: Direction | null;
  riasec: { key: RiasecType; band: ScaleScore<RiasecType>['band'] }[];
  entries: SynthesisEntry[];
  /** האם הטענות המסורתיות בנושא מסכימות זו עם זו. */
  agreement: 'same' | 'mixed' | 'single' | 'none';
}

export interface Synthesis {
  themes: SynthesisTheme[];
  /** טענות שהושוו לשאלון (שאלון לא באמצע). */
  compared: number;
  /** מתוכן: באותו כיוון כמו השאלון. */
  matched: number;
  /** טענות בנושא שבו השאלון באמצע הסולם. */
  neutral: number;
  /** טענות בלי מקבילה בשאלון. */
  unanchored: number;
  total: number;
}

export interface Report {
  sessionId: string;
  generatedAt: number;
  isDemo: boolean;
  bigFive: ScaleScore<BigFiveTrait>[];
  riasec: ScaleScore<RiasecType>[];
  hollandCode: string | null;
  /** שוויון בציונים שמשפיע על הסדר או על הבחירה בקוד — מוצג למשתמש. */
  hollandTie: boolean;
  /** שאלות הרקע שנענו, כהקשר בלבד. */
  background: Background;
  /** תצפיות ישנות של מאפיינים שהוסרו (כמו לחץ כתיבה), שנשארו באחסון ולא נכנסו לדוח. */
  retiredObservations: number;
  /** ערוצים שבהם תצפיות שמורות לא נכנסו לדוח: אין תמונה, או שהתמונה נכשלה בבדיקת האיכות. */
  excludedObservations: { channel: ChannelId; count: number; reason: string }[];
  channels: {
    channel: ChannelId;
    hasImage: boolean;
    quality?: QualityReport;
    computed?: ComputedFeatures;
    observations: Observation[];
    traditions: TraditionNote[];
  }[];
  integration: IntegrationNote[];
  /** שלב השילוב: כל המקורות לפי נושאים. לא משפיע על הציונים. */
  synthesis: Synthesis;
  reflections: ReflectionPrompt[];
  claimsUsed: string[];
  qa: QACheck[];
}
