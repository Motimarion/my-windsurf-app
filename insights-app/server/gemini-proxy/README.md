# השרת של גרסת הצרכן (Gemini)

פונקציה קטנה ב־Google Cloud Run functions. היא מקבלת מהאפליקציה תמונה אחת ושם ערוץ, מוסיפה את ההנחיה הסמויה ואת הרשימה הסגורה
(`engine.json`), שולחת ל־Gemini ומחזירה את התשובה. המפתח של Gemini נשמר רק כאן, כסוד בענן. השרת לא שומר תמונות ולא כותב אותן ליומן.

## מה השרת בודק

- **מקור:** רק האתר המורשה (`ALLOWED_ORIGINS`). בקשה מאתר אחר נחסמת.
- **תוכן:** רק ערוץ קיים, תמונה מסוג JPEG, PNG או WebP, ועד כ־5MB. אי אפשר לשלוח דרכו טקסט חופשי למודל.
- **כף יד:** נשלחת רק כש־`PAID_TIER=true`, כלומר כשהמפתח בפרויקט עם חיוב פעיל. לפי תנאי Gemini API אין לשלוח מידע אישי לשירות ללא תשלום.
- **מגבלות שימוש:** עד 20 תמונות ב־10 דקות לכל כתובת IP, ועד 500 ביום לכל מופע של השרת. אפשר לשנות (`RATE_PER_IP`, `DAILY_LIMIT`).

## העלאה (פעם אחת, כ־15 דקות, ממחשב)

1. **מפתח בתשלום:** ב־[Google AI Studio](https://aistudio.google.com/apikey) יוצרים מפתח בפרויקט Google Cloud שיש בו חיוב פעיל.
   בהגדרות המפתח ב־Google Cloud כדאי להגביל אותו ל־Generative Language API בלבד.
2. **תקציב:** ב־Billing ← Budgets & alerts מגדירים תקציב חודשי והתראה, כדי שלא יהיו הפתעות.
3. **Cloud Shell:** במסוף של Google Cloud לוחצים על סמל ה־Cloud Shell (למעלה), ומריצים:

   ```bash
   git clone -b claude/ai-insights-report-system-r4d8b2 https://github.com/Motimarion/my-windsurf-app
   cd my-windsurf-app/insights-app/server/gemini-proxy

   # המפתח נשמר כסוד. מדביקים אותו כשהפקודה מחכה, ואז לוחצים Ctrl+D (פעמיים אם צריך).
   gcloud secrets create gemini-api-key --data-file=-

   gcloud functions deploy chiropology-describe \
     --gen2 --runtime=nodejs22 --region=me-west1 \
     --source=. --entry-point=describe --trigger-http --allow-unauthenticated \
     --max-instances=2 \
     --set-env-vars=ALLOWED_ORIGINS=https://motimarion.github.io,PAID_TIER=true \
     --set-secrets=GEMINI_API_KEY=gemini-api-key:latest
   ```

   אם המסוף שואל אם להפעיל ממשקים (APIs) או לתת הרשאה לגשת לסוד, עונים `y`.
4. **הכתובת:** בסוף ההעלאה מופיעה כתובת (`url: https://...`). את הכתובת הזו שולחים ל־Claude. היא נכנסת ל־`VITE_PROXY_URL` בקובץ
   `insights-app/.env.consumer`. הכתובת לא סודית. המפתח לא יוצא מהשרת.

## בדיקה מקומית

```bash
npm install
GEMINI_API_KEY=... PAID_TIER=true npm start   # http://localhost:8080
```

הבדיקות האוטומטיות של השרת נמצאות ב־`insights-app/src/__tests__/proxy.test.ts`.
אחרי כל שינוי בהנחיה או ברשימות הערכים מריצים `npm run export:engine` בתיקייה `insights-app`, ובדיקה מוודאת ש־`engine.json` מעודכן.
