// מייצא את מצגת ההדרכה (deck.html) ל־PDF אחד (טקסט וקטורי) ול־PNG לכל שקף.
// הרצה מתוך insights-app:  node docs/slides/render-deck.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(here, 'deck.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))));
  const slides = page.locator('section.slide');
  const n = await slides.count();
  for (let i = 0; i < n; i++) {
    await slides.nth(i).screenshot({ path: join(here, `deck-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await page.pdf({ path: join(here, 'deck.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  console.log(`deck.pdf + ${n} PNG`);
} finally {
  await browser.close();
}
