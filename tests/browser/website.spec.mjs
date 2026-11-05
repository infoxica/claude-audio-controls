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

test('website requires consent, supports withdrawal, and hides unavailable stores', async ({page}) => {
  const requests = await website(page);
  expect(requests).toHaveLength(0);
  expect(await page.locator('[data-store]').count()).toBe(0);
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
  for (const locale of ['ar', 'hi', 'fr', 'ja']) {
    await page.goto(`http://127.0.0.1:4174/${locale}/guide/`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    expect(await page.locator('main').innerText()).not.toContain('undefined');
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toContain(`/${locale}/guide/`);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:4174/ar/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  expect(requests).toHaveLength(0);
});
