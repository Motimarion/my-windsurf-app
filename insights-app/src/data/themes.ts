// שלב השילוב — הנושאים שדרכם כל המקורות נפגשים.
//
// עוגן כל נושא הוא תכונת Big Five מהשאלון (המקור היחיד לציונים). לצידו מוצגות הטענות המסורתיות
// מכף היד, מכתב היד ומהציורים, אחרי שתורגמו לנושא ולכיוון. התרגום הוא שלנו, לצורך השוואה בלבד:
// הוא לא חלק מהמסורת ולא ממצא מחקרי. טענה שאין לה מקבילה ברורה בשאלון נשארת בנושא "אחר".
import type { BigFiveTrait, Direction, RiasecType, ThemeId } from '../types';

export interface ThemeDef {
  id: ThemeId;
  title: string;
  /** תכונת ה־Big Five שמשמשת עוגן מדוד. */
  trait?: BigFiveTrait;
  /** ציון גבוה בתכונה פירושו כיוון הפוך בנושא (נוירוטיות ↔ יציבות). */
  inverted?: boolean;
  /** תחומי עניין קשורים לפי המטא־אנליזה (Barrick et al., 2003). מוצגים כהקשר, בלי השוואה למסורות. */
  riasec: RiasecType[];
  up: string;
  down: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'extraversion', title: 'פנייה לאחרים ואנרגיה', trait: 'E', riasec: ['E', 'S'], up: 'פתיחות ואנרגיה', down: 'הסתייגות ושמירת מרחב' },
  { id: 'warmth', title: 'חום ויחסים', trait: 'A', riasec: ['S'], up: 'חום ואידיאליזם ביחסים', down: 'ריחוק' },
  { id: 'order', title: 'סדר, שליטה עצמית והישגיות', trait: 'C', riasec: ['C'], up: 'שיטתיות, ריכוז והישגיות', down: 'ספונטניות' },
  { id: 'stability', title: 'יציבות רגשית וביטחון', trait: 'N', inverted: true, riasec: [], up: 'איזון, ביטחון ואופטימיות', down: 'רגישות וחוסר ביטחון' },
  { id: 'imagination', title: 'דמיון וחשיבה', trait: 'I', riasec: ['A', 'I'], up: 'דמיון, יצירתיות וחשיבה', down: 'מעשיות' },
  { id: 'other', title: 'טענות בלי מקבילה בשאלון', riasec: [], up: '', down: '' },
];

export const themeById = (id: ThemeId) => THEMES.find((t) => t.id === id)!;

const M = (theme: ThemeId, dir: Direction) => ({ theme, dir });

/**
 * כל טענה מסורתית (לפי המזהה שלה ב־channels.ts) → נושא וכיוון.
 * בדיקת יחידה מוודאת שלכל טענה יש שורה כאן.
 */
export const TRADITION_THEME: Record<string, { theme: ThemeId; dir: Direction }> = {
  // כירומנטיה
  'palm.heartLineEnd=בין המורה לאמה': M('stability', 1), // איזון בין רגש לשיקול דעת
  'palm.heartLineEnd=מתחת לאצבע המורה': M('warmth', 1), // אידיאליזם ברגש
  'palm.heartLineEnd=מתחת לאמה': M('other', 0), // גישה מעשית ליחסים: בלי כיוון ברור בשאלון
  'palm.headLineShape=מעוקל': M('imagination', 1), // דמיון ויצירתיות
  'palm.headLineShape=ישר': M('order', 1), // חשיבה מעשית ושיטתית
  'palm.lifeLineArc=רחבה': M('extraversion', 1), // חיוניות
  'palm.lifeLineArc=צרה': M('extraversion', -1), // זהירות ושמירת אנרגיה

  // גרפולוגיה
  'hw.slant=קדימה (בכיוון הכתיבה)': M('extraversion', 1), // פנייה לזולת והבעה רגשית
  'hw.slant=זקופה': M('order', 1), // שליטה עצמית ואיפוק
  'hw.slant=אחורה': M('extraversion', -1), // הסתייגות או זהירות חברתית
  'hw.size=גדול': M('extraversion', 1), // ביטחון עצמי וצורך בנראות
  'hw.size=קטן': M('order', 1), // ריכוז ותשומת לב לפרטים
  'hw.baseline=עולה': M('stability', 1), // אופטימיות
  'hw.baseline=יורד': M('stability', -1), // עייפות
  'hw.spacing=מרווח': M('extraversion', -1), // צורך במרחב אישי

  // מבחן העץ ובית־עץ־אדם
  'tree.roots=מצוירים': M('other', 0), // צורך בביסוס ובקשר לעבר
  'tree.fruit=מצוירים': M('order', 1), // הישגיות
  'tree.trunk=עבה': M('stability', 1), // תחושת כוח ויציבות
  'tree.trunk=דק': M('stability', -1), // רגישות
  'tree.crown=ענפים פתוחים': M('extraversion', 1), // פתיחות לסביבה
  'drawing.size=קטן': M('stability', -1), // חוסר ביטחון (עץ ואדם)
  'drawing.size=גדול': M('stability', 1), // ביטחון או התפשטות (עץ ואדם)
  'drawing.placement=צד שמאל': M('other', 0), // התמקדות בעבר
  'drawing.placement=צד ימין': M('other', 0), // התמקדות בעתיד

  // ציור דמות
  'person.hands=מוסתרות': M('extraversion', -1), // קושי ביצירת קשר
  'person.face=ללא': M('extraversion', -1), // ריחוק חברתי
  'person.completeness=ראש בלבד': M('imagination', 1), // התמקדות אינטלקטואלית
};
