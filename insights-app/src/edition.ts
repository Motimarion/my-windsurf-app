// שתי גרסאות מאותו קוד:
// course — גרסת הקורס (מחקר והדגמה, גשר ידני או מפתח אישי), נבנית ב־npm run build.
// consumer — גרסת הצרכן (תיאור דרך השרת, שמירה בדרייב), נבנית ב־npm run build:consumer עם ‎.env.consumer.
export const EDITION: 'course' | 'consumer' = import.meta.env.VITE_EDITION === 'consumer' ? 'consumer' : 'course';
export const IS_CONSUMER = EDITION === 'consumer';

/** תווית קבועה בכותרת של כל מסך. בגרסת הצרכן היא תואמת את המטרה המוצהרת: ניתוח אישיות לא מחייב. */
export const EDITION_LABEL = IS_CONSUMER ? 'ניתוח אישיות לא מחייב — לא אבחון' : 'מחקר והדגמה — לא אבחון';

/** שורת הבהרה שמופיעה בראש כל עמוד של הדוח ב־PDF ובתחתית כל עמוד בהדפסה. */
export const PAGE_DISCLAIMER = IS_CONSUMER
  ? 'ניתוח אישיות לא מחייב, לפי שאלונים ומסורות פרשנות · אינו אבחון פסיכולוגי, רפואי או תעסוקתי'
  : 'מחקר והדגמה בלבד · אינו אבחון פסיכולוגי, רפואי או תעסוקתי · אין להשתמש בו להחלטות על אנשים';

/** שורת התחתית: איפה הנתונים נמצאים. בגרסת הצרכן תמונות יוצאות מהמכשיר, ולכן הנוסח שונה. */
export const FOOTER_NOTE = IS_CONSUMER
  ? 'הדוח נשמר במכשיר זה. תמונות נשלחות לתיאור ב־Gemini דרך השרת, והשרת לא שומר אותן'
  : 'כל הנתונים נשמרים במכשיר זה בלבד · גרסת MVP';

/** כתובת השרת של גרסת הצרכן (Cloud Run functions). ריקה עד שהשרת עולה. */
export const PROXY_URL: string = String(import.meta.env.VITE_PROXY_URL ?? '').trim();

/** מזהה OAuth של Google לשמירה בדרייב. ריק עד שהוא נוצר. */
export const GOOGLE_CLIENT_ID: string = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
