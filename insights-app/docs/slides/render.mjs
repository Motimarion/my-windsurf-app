// מייצא את שקפי ה־HTML שבתיקייה ל־PNG בגודל 1920×1080.
// הרצה מתוך insights-app:  node docs/slides/render.mjs [שם-קובץ-בלי-סיומת ...]
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['flow-slide-v2', 'flow-slide-qa'];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const name of names) {
    await page.goto(pathToFileURL(join(here, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 1920 || document.documentElement.scrollHeight > 1080);
    await page.screenshot({ path: join(here, `${name}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log(`${name}.png${overflow ? ' (אזהרה: תוכן חורג מ־1920×1080)' : ''}`);
  }
} finally {
  await browser.close();
}
