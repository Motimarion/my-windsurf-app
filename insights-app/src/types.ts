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

/** תצפית מובנית אחת — מה רואים, לא מה זה "אומר". */
export interface Observation {
  featureId: string;
  value: string;
  source: 'manual' | 'computed' | 'demo' | 'ai';
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
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
  consent: ConsentRecord | null;
  ipip: LikertAnswers;
  riasec: LikertAnswers;
  observations: Partial<Record<ChannelId, Observation[]>>;
  analyzedAt?: number;
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

export interface Report {
  sessionId: string;
  generatedAt: number;
  isDemo: boolean;
  bigFive: ScaleScore<BigFiveTrait>[];
  riasec: ScaleScore<RiasecType>[];
  hollandCode: string | null;
  /** שוויון בציונים שמשפיע על הסדר או על הבחירה בקוד — מוצג למשתמש. */
  hollandTie: boolean;
  channels: {
    channel: ChannelId;
    hasImage: boolean;
    quality?: QualityReport;
    computed?: ComputedFeatures;
    observations: Observation[];
    traditions: TraditionNote[];
  }[];
  integration: IntegrationNote[];
  reflections: ReflectionPrompt[];
  claimsUsed: string[];
  qa: QACheck[];
}
