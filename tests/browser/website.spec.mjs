import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

async function website(page, staging = false) {
  const base = resolve('site-dist');
  const requests = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'www.googletagmanager.com') {
      requests.push(url.href);
      return route.fulfill({body: '', contentType: 'text/javascript'});
    }
    if (url.hostname !== '127.0.0.1') return route.abort();
    let file = resolve(base, '.' + decodeURIComponent(url.pathname));
    if (file !== base && !file.startsWith(base + '/') && !file.startsWith(base + '\\')) return route.abort();
    if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
    if (!existsSync(file)) return route.fulfill({status: 404, body: 'Not found'});
    let body = readFileSync(file);
    if (extname(file) === '.html') {
      let html = body.toString().replaceAll('https://claude-audio-controls.infoxica.com/', 'http://127.0.0.1:4174/');
      if (staging) html = html.replace(/data-ga4="[^"]*"/, 'data-ga4=""');
      body = Buffer.from(html);
    }
    return route.fulfill({body, contentType: ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(file)] || 'text/plain'});
  });
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.locator('#consent')).toBeVisible();
  return requests;
}

test('website requires consent, supports withdrawal, and links to the assigned stores', async ({page}) => {
  const requests = await website(page);
  expect(requests).toHaveLength(0);
  await expect(page.locator('.hero [data-store=chrome]')).toHaveAttribute('href', /chromewebstore\.google\.com\/detail\/phpfodemdjccejlpchbeeehjdgaldldi/);
  await expect(page.locator('.hero [data-store=edge]')).toHaveAttribute('href', /microsoftedge\.microsoft\.com\/addons\/detail\/gabdlfkfofnclhnpcmdfikijmmckpcee/);
  await page.locator('#analytics-decline').click();
  await expect(page.locator('#consent')).toBeHidden();
  expect(requests).toHaveLength(0);
  await page.locator('#analytics-preferences').click();
  await page.locator('#analytics-accept').click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toContain('G-XSDHJ2SBTF');
  await page.locator('#analytics-preferences').click();
  await page.locator('#analytics-decline').click();
  expect(await page.evaluate(() => window['ga-disable-' + document.body.dataset.ga4])).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('claude-audio-website-analytics'))).toBe('declined');
});

test('staging never loads analytics; localized navigation and responsive layouts render', async ({page}) => {
  const requests = await website(page, true);
  await page.locator('#analytics-accept').click();
  expect(requests).toHaveLength(0);
  await page.setViewportSize({width: 1280, height: 900});
  await expect(page.locator('h1')).toContainText('Claude');
  mkdirSync('assets/demo', {recursive: true});
  await page.screenshot({path: 'assets/demo/website.png'});
  await expect(page.locator('#demo-note')).toHaveCount(0);
  await expect(page.locator('#layouts figure')).toHaveCount(19);
  await expect(page.locator('#layouts figure:visible')).toHaveCount(1);
  const carousel = page.locator('.layout-carousel');
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#layout-picker')).toHaveValue('1');
  await page.locator('#layouts figure:visible a').click();
  await expect(page.locator('.image-viewer[open] img')).toHaveAttribute('src',/composer-controls\.png$/);
  await page.keyboard.press('End');
  await expect(page.locator('.image-viewer[open] img')).toHaveAttribute('src',/mobile\.png$/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.image-viewer[open] img')).toHaveAttribute('src',/composer-seek\.png$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#layouts figure:visible a')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('#layout-picker')).toHaveValue('18');
  await page.keyboard.press('Home');
  await page.locator('[data-layout-previous]').click();
  await expect(page.locator('#layout-picker')).toHaveValue('18');
  await page.locator('[data-layout-next]').click();
  await expect(page.locator('#layout-picker')).toHaveValue('0');
  await page.locator('#layout-picker').selectOption('6');
  await expect(page.locator('#layouts figure:visible img')).not.toHaveAttribute('src',/composer/);
  await page.locator('#layout-picker').selectOption('0');
  await page.locator('#layouts').evaluate(el => el.scrollIntoView({block:'start'}));
  await page.screenshot({path:'build/website-layout-carousel.png',animations:'disabled'});
  for (const locale of ['ar', 'hi', 'fr', 'ja']) {
    await page.goto(`http://127.0.0.1:4174/${locale}/guide/`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    expect(await page.locator('main').innerText()).not.toContain('undefined');
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toContain(`/${locale}/guide/`);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:4174/ar/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.layout-carousel').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#layout-picker')).toHaveValue('1');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#layout-picker')).toHaveValue('0');
  await page.locator('#layouts figure:visible a').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.image-viewer[open] img')).toHaveAttribute('src',/composer-controls\.png$/);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  expect(requests).toHaveLength(0);
});
