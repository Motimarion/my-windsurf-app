// מצלם מחדש את 03-engine-station.png: כרטיס תחנת המנוע בגשר הידני, על ציור העץ של ההדגמה.
// הרצה מתוך insights-app, אחרי npm run build:  node docs/review-images/capture-engine.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4183;
const BASE = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stop = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* כבר נעצר */
  }
};
await new Promise((res, rej) => {
  const t = setTimeout(() => (stop(), rej(new Error('preview timeout'))), 20000);
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && (clearTimeout(t), res()));
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'he-IL' });
  await page.goto(BASE);
  await page.getByRole('button', { name: 'הדגמה עם נתונים סינתטיים' }).click();
  await page.waitForURL(/#\/s\/[a-z0-9]+$/);
  const sid = page.url().split('/s/')[1];
  await page.goto(`${BASE}#/s/${sid}/c/drawingTree`);
  await page.getByText('בדיקת איכות').waitFor();

  const card = page.locator('.card', { has: page.getByRole('heading', { name: /תיאור בעזרת מודל AI/ }) });
  await card.locator('input[type=checkbox]').check();
  await card.getByRole('radio', { name: 'Gemini', exact: true }).click();
  await card.getByLabel('התשובה של המודל').fill(
    '```json\n{"observations":[{"featureId":"tree.roots","value":"מצוירים"},{"featureId":"tree.crown","value":"מעוגלת / ענן"},{"featureId":"tree.trunk","value":"עבה"},{"featureId":"tree.fruit","value":"לא מצוירים"},{"featureId":"tree.ground","value":"מצויר"},{"featureId":"drawing.size","value":"גדול"},{"featureId":"tree.mood","value":"שמח"}],"imageUsable":true}\n```\n\nהעץ משדר יציבות ושורשיות.',
  );
  await card.getByRole('button', { name: 'בדיקה בשער הרשימה הסגורה' }).click();
  await card.locator('.badge', { hasText: 'התקבלו' }).waitFor();
  // הכותרת הדביקה של האתר מסתירה חלק מהכרטיס בצילום, ולכן היא מוסתרת רק לצורך הצילום.
  await page.addStyleTag({ content: 'header, .toast, [role=status] { visibility: hidden !important; }' });
  await card.screenshot({ path: join(here, '03-engine-station.png') });
  console.log('03-engine-station.png');
} finally {
  await browser.close();
  stop();
}
