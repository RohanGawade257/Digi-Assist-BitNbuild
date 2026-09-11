import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {login} from './fixtures';
import {enabledLocales} from '@guide/contracts';
import {brand} from '../../apps/web/lib/brand';
import copy from '../../apps/web/lib/voice-copy.json';

test('VaaniSetu branding, optimized scene, explicit opaque mode and supported fallback',async({page,context})=>{
 await page.goto('/');await expect(page).toHaveTitle(brand.title);await expect(page.locator('.topbar .vaani-wordmark')).toContainText('VaaniSetu');
 expect(await page.locator('meta[name=description]').getAttribute('content')).toBe(brand.description);
 const manifest=await (await page.request.get('/manifest.webmanifest')).json();expect(manifest.short_name).toBe('VaaniSetu');
 const background=await page.request.get('/backgrounds/vaanisetu-desktop.webp');expect(background.ok()).toBe(true);expect((await background.body()).length).toBeLessThan(20000);
 await expect(page.locator('.scene-image')).toHaveCSS('background-size','cover');expect(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).backdropFilter)).toContain('blur');expect(await page.locator('.language-card').evaluate(e=>getComputedStyle(e).backdropFilter)).toContain('blur');
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(scan.violations).toEqual([]);
 await login(page);await page.locator('.topbar').getByRole('button',{name:'Accessibility',exact:true}).click();await page.getByRole('checkbox',{name:'High contrast',exact:true}).check();await page.locator('.app-dialog[open] > header button').click();
 await expect(page.locator('.scene-background')).toBeHidden();await expect(page.locator('.topbar')).toHaveCSS('backdrop-filter','none');await page.screenshot({path:'test-results/vaanisetu-high-contrast.png',fullPage:true});
 const contrast=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(contrast.violations).toEqual([]);
 const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await expect(pip).toHaveTitle(brand.title);await expect(pip.locator('.approval-workspace')).toHaveClass(/opaque/);await expect(pip.locator('.scene-background')).toHaveCount(0);await pip.evaluate(()=>window.close());
 // Simulate a missing background: essential HTML remains usable over the configured gradient.
 await page.locator('.topbar').getByRole('button',{name:'Accessibility',exact:true}).click();await page.getByRole('checkbox',{name:'High contrast',exact:true}).uncheck();await page.locator('.app-dialog[open] > header button').click();
 await page.locator('.scene-image').evaluate(e=>(e as HTMLElement).style.backgroundImage='url(/missing-decoration.webp)');await expect(page.locator('.start-options')).toBeVisible();await expect(page.locator('.scene-background')).not.toHaveCSS('background-image','none');
});

test('all five branded introduction files match fixed copy and valid WAV data',()=>{
 const manifest=JSON.parse(readFileSync('apps/web/public/voice/manifest.json','utf8'));
 for(const locale of enabledLocales){
  const bytes=readFileSync(`apps/web/public/voice/${locale}/intro.wav`),asset=manifest[`${locale}/intro`];expect(copy[locale].title).toContain('VaaniSetu');expect(bytes.subarray(0,4).toString()).toBe('RIFF');
  expect(asset.textSha256).toBe(createHash('sha256').update(copy[locale].intro).digest('hex'));expect(asset.audioSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 }
});
