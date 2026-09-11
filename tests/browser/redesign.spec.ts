import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {login} from './fixtures';
import {enabledLocales} from '@guide/contracts';
test('localized floating actions fit, keyboard settings restore focus and large text can scroll',async({page,context})=>{
 await login(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});navigator.mediaDevices.getDisplayMedia=async()=>{const c=document.createElement('canvas');c.width=480;c.height=240;c.getContext('2d')!.fillRect(0,0,480,240);return c.captureStream(10);};});
 for(const locale of enabledLocales){
  await page.locator('.topbar nav button').first().click();await page.locator('#preferences select').first().selectOption(locale);await page.locator('.app-dialog[open] > header button').click();
  const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await pip.setViewportSize({width:390,height:480});
  if(await pip.locator('.share-primary').isVisible())await pip.locator('.share-primary').click();
  const consent=pip.locator('.screen-consent-setup input');if(await consent.isVisible())await consent.click();
  const primary=pip.locator('.capture-send');await expect(primary).toBeEnabled();expect(await primary.evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(480);
  const result=await new AxeBuilder({page:pip}).withTags(['wcag2a','wcag2aa']).analyze();expect(result.violations).toEqual([]);
  await pip.locator('.workspace-header button').click();await expect(pip.locator('.app-dialog[open]')).toBeVisible();await pip.keyboard.press('Escape');await expect(pip.locator('.workspace-header button')).toBeFocused();
  if(locale==='te-IN'){await pip.screenshot({path:'test-results/redesign-floating-telugu.png'});await pip.locator('.assistant-portal').evaluate(e=>e.classList.add('large'));await expect(primary).toBeVisible();expect(await pip.evaluate(()=>getComputedStyle(document.body).overflow)).not.toBe('hidden');}
  await pip.evaluate(()=>window.close());
 }
 await page.locator('.topbar button.stop').click();
});
test('redesigned surfaces, native controller, keyboard dialogs and mobile navigation',async({page,context})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await expect(page.getByRole('heading',{name:'A little guidance. A lot more confidence.'})).toBeVisible();
 await page.screenshot({path:'test-results/redesign-introduction.png',fullPage:true});
 await page.locator('.topbar').getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sign in',exact:true})).toBeVisible();await page.screenshot({path:'test-results/redesign-authentication.png'});await page.keyboard.press('Escape');await expect(page.locator('.topbar').getByRole('button',{name:'Sign in',exact:true})).toBeFocused();
 await login(page);await expect(page.locator('.start-options')).toBeVisible();await expect(page.locator('.workspace-chat')).toBeVisible();
 await page.screenshot({path:'test-results/redesign-workspace.png',fullPage:true});
 const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(a11y.violations).toEqual([]);
 await page.locator('.topbar').getByRole('button',{name:'Accessibility',exact:true}).click();await page.screenshot({path:'test-results/redesign-settings.png'});await page.keyboard.press('Escape');await expect(page.locator('.topbar').getByRole('button',{name:'Accessibility',exact:true})).toBeFocused();
 await page.evaluate(()=>{Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=240;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e8f1ee';ctx.fillRect(0,0,480,240);ctx.fillStyle='#155e50';ctx.font='24px sans-serif';ctx.fillText('VIOLET COMPASS — NEXT STEP',15,100);return canvas.captureStream(10);};});
 const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await pip.setViewportSize({width:390,height:480});await expect(pip.getByRole('button',{name:'Share screen',exact:true})).toBeVisible();await pip.screenshot({path:'test-results/redesign-floating-before.png'});
 await pip.getByRole('button',{name:'Share screen',exact:true}).click();const checkbox=pip.getByRole('checkbox',{name:/When I press Capture/});await expect(checkbox).toBeVisible();await pip.screenshot({path:'test-results/redesign-floating-consent.png'});await checkbox.click();
 const primary=pip.getByRole('button',{name:'Capture current screen and send',exact:true});await expect(primary).toBeVisible();expect(await primary.evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(480);await pip.screenshot({path:'test-results/redesign-floating-after.png'});
 await primary.click();await expect(pip.locator('.conversation-turn')).toHaveCount(1);await pip.getByRole('button',{name:'Chat',exact:true}).first().click();await pip.setViewportSize({width:800,height:650});await pip.locator('#question').fill('Keep my draft');await expect(pip.locator('.workspace-header')).toBeInViewport();await pip.screenshot({path:'test-results/redesign-chat.png'});await pip.evaluate(()=>window.close());await expect(page.locator('#question')).toHaveValue('Keep my draft');await page.screenshot({path:'test-results/redesign-sharing.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.locator('.workspace-tabs').getByRole('button',{name:'Conversation',exact:true}).click();await page.screenshot({path:'test-results/redesign-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.workspace-source small').evaluate(e=>getComputedStyle(e,'::before').animationName)).toBe('none');
 const ended=page.waitForResponse(r=>r.url().endsWith('/end'));await page.locator('.topbar button.stop').click();await ended;await expect(page.getByRole('button',{name:'Start again',exact:true})).toBeVisible();await expect(page.locator('.journey-grid')).toBeHidden();
});
