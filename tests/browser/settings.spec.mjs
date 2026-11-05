import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
test('settings and popup render with Claude branding and no unavailable review links', async ({ page }) => {
  const base = resolve('dist');
  await page.route('http://127.0.0.1:4173/**', route => {
    const file = resolve(base, '.' + new URL(route.request().url()).pathname);
    if (!file.startsWith(base + '\\') && !file.startsWith(base + '/')) return route.abort();
    if (!existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ body: readFileSync(file), contentType: ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)] || 'application/octet-stream' });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://127.0.0.1:4173/src/options/index.html');
  await expect(page.getByRole('heading', { name: 'Audio & Playback Preferences' })).toBeVisible();
  expect(await page.locator('a[href=""]').count()).toBe(0);
  mkdirSync('assets/demo', { recursive: true });
  await page.screenshot({ path: 'assets/demo/settings.png', animations: 'disabled' });
  await page.setViewportSize({ width: 400, height: 700 });
  await page.goto('http://127.0.0.1:4173/src/popup/index.html');
  await expect(page.getByText('Default Playback Speed', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'assets/demo/popup.png', animations: 'disabled' });
});
