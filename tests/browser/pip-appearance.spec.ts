import {test,expect} from '@playwright/test';
import {login} from './fixtures';

test('PiP transparent wrappers, idle content, protected consent and draft',async({page,context})=>{
 test.setTimeout(60000);
 await login(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'userActivation',{value:{isActive:false}});navigator.mediaDevices.getDisplayMedia=async()=>{const c=document.createElement('canvas');c.width=480;c.height=240;c.getContext('2d')!.fillRect(0,0,480,240);return c.captureStream(10);};});
 const opened=context.waitForEvent('page');await page.locator('#open-floating-assistant').click();const pip=await opened;await pip.setViewportSize({width:390,height:480});
 const panel=pip.locator('.approval-workspace'),content=pip.locator('.pip-content');
 for(const selector of ['html','body','.assistant-portal']){await expect(pip.locator(selector)).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(pip.locator(selector)).toHaveCSS('background-image','none');}
 await expect(panel).toHaveCSS('background-color','rgba(225, 241, 234, 0.18)');
 expect(await panel.evaluate(e=>getComputedStyle(e,'::before').content)).toBe('none');
 expect(await pip.locator('*').evaluateAll(elements=>elements.filter(e=>getComputedStyle(e).backgroundImage!=='none').map(e=>e.className))).toEqual([]);
 await pip.mouse.move(385,475);await pip.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});
 await expect(content).toHaveCSS('opacity','0.2');await expect(pip.getByRole('button',{name:'Stop speaking',exact:true})).toBeVisible();
 await pip.screenshot({path:'test-results/pip-idle.png'});
 await panel.hover();await expect(content).toHaveCSS('opacity','1');await expect(panel).toHaveCSS('background-color','rgba(225, 241, 234, 0.18)');await pip.screenshot({path:'test-results/pip-active.png'});
 await pip.getByRole('button',{name:'Settings',exact:true}).focus();await pip.mouse.move(385,475);await pip.waitForTimeout(1800);await expect(content).toHaveCSS('opacity','1');
 await pip.locator('.share-primary').click();await pip.locator('.screen-consent-setup input').waitFor();await pip.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await pip.mouse.move(385,475);await pip.waitForTimeout(1800);await expect(content).toHaveCSS('opacity','1');
 await pip.locator('.screen-consent-setup input').click();await pip.locator('.capture-send').click();await expect(pip.locator('.conversation-turn')).toHaveCount(1);
 await pip.getByRole('button',{name:'Chat',exact:true}).first().click();await pip.locator('#question').fill('Keep this draft');await pip.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await pip.mouse.move(790,640);await pip.waitForTimeout(1800);await expect(content).toHaveCSS('opacity','1');
 await pip.getByRole('button',{name:'Settings',exact:true}).click();await pip.getByRole('button',{name:'Keep visible',exact:true}).click();await pip.keyboard.press('Escape');await pip.locator('#question').fill('');await pip.getByRole('button',{name:'Close chat',exact:true}).first().click();await pip.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await pip.mouse.move(385,475);await pip.waitForTimeout(1800);await expect(content).toHaveCSS('opacity','1');
 await pip.getByRole('button',{name:'Settings',exact:true}).click();await pip.getByRole('button',{name:'Keep visible',exact:true}).click();await pip.getByRole('checkbox',{name:'High contrast',exact:true}).check();await pip.keyboard.press('Escape');await expect(panel).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(content).toHaveCSS('opacity','1');
 await pip.getByRole('button',{name:'Settings',exact:true}).click();await pip.getByRole('button',{name:'Minimize',exact:true}).click();await expect(content).toBeHidden();await expect(pip.getByRole('button',{name:'Stop speaking',exact:true})).toBeVisible();await pip.getByRole('button',{name:/Expand assistant/}).click();await expect(content).toBeVisible();
 await pip.getByRole('button',{name:'End assistance',exact:true}).click();
});
