// שתי גרסאות מאותו קוד:
// course — גרסת הקורס (מחקר והדגמה, גשר ידני או מפתח אישי), נבנית ב־npm run build.
// consumer — גרסת הצרכן (תיאור דרך השרת, שמירה בדרייב), נבנית ב־npm run build:consumer עם ‎.env.consumer.
export const EDITION: 'course' | 'consumer' = import.meta.env.VITE_EDITION === 'consumer' ? 'consumer' : 'course';
export const IS_CONSUMER = EDITION === 'consumer';

/** כתובת השרת של גרסת הצרכן (Cloud Run functions). ריקה עד שהשרת עולה. */
export const PROXY_URL: string = String(import.meta.env.VITE_PROXY_URL ?? '').trim();

/** מזהה OAuth של Google לשמירה בדרייב. ריק עד שהוא נוצר. */
export const GOOGLE_CLIENT_ID: string = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
