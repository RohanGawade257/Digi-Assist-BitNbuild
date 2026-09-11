const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('test-results/inspection', { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:3000'); await page.screenshot({ path: 'test-results/inspection/onboarding.png', fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.screenshot({ path: 'test-results/inspection/workspace.png', fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/inspection/mobile-start.png', fullPage: true });
    await page.getByRole('button', { name: 'Language and comfort', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Larger text', exact: true }).check();
    console.log(JSON.stringify(await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })).filter(item => item.right > innerWidth + 1) })), null, 2));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/inspection/mobile.png', fullPage: true });
    await page.getByRole('checkbox', { name: 'Larger text', exact: true }).uncheck();
    await page.locator('#preferences select').nth(1).selectOption('ur-IN');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/inspection/urdu-mobile.png', fullPage: true });
  } finally { await browser.close(); }
})().catch(() => { console.error('UI inspection failed'); process.exitCode = 1; });
