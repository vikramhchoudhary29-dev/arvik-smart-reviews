import { test, expect } from '@playwright/test';
test('mobile genuine review, three drafts, edit, copy success and same-tab navigation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let outbound = false;
  await page.route('https://g.page/**', async (r) => {
    outbound = true;
    await r.fulfill({
      contentType: 'text/html',
      body: '<h1>Google destination intercepted for test</h1>',
    });
  });
  await page.goto('/r/browser-test');
  await expect(page.getByRole('heading', { name: 'Shree Optical', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lens quality', exact: true }).click();
  await page.getByRole('button', { name: 'Pricing', exact: true }).click();
  await page.getByLabel('How was your experience?').selectOption('critical');
  await page.getByRole('button', { name: 'Generate three suggestions' }).click();
  await expect(page.getByRole('button', { name: 'Short', exact: false })).toBeVisible();
  const short = page.getByRole('button', { name: 'Short', exact: false });
  const before = await short.textContent();
  await page.getByRole('button', { name: 'Regenerate suggestions' }).click();
  await expect(short).not.toHaveText(before || '');
  await page.getByRole('button', { name: 'Detailed', exact: false }).click();
  await page.getByLabel('Your review — freely editable').fill('My real experience, edited by me.');
  await page.screenshot({ path: 'test-results/mobile-review.png', fullPage: true });
  await page.getByRole('button', { name: 'Copy & Continue to Google' }).click();
  await expect(page).toHaveURL('https://g.page/r/browser-test/review');
  expect(outbound).toBe(true);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'My real experience, edited by me.',
  );
});
test('clipboard denial preserves draft and exposes manual fallback without claiming copied', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(Error('denied')) },
    });
  });
  await page.goto('/r/browser-test');
  await page.getByLabel('Your review — freely editable').fill('My honest words.');
  await page.getByRole('button', { name: 'Copy & Continue to Google' }).click();
  await expect(page.locator('p[role=alert]')).toContainText('Could not copy');
  await expect(page.getByLabel('Your review — freely editable')).toHaveValue('My honest words.');
  await expect(page.getByRole('link', { name: 'Open Google Reviews' })).toBeVisible();
  await expect(page.getByRole('status')).not.toContainText('Copied');
  await page.screenshot({ path: 'test-results/clipboard-fallback.png', fullPage: true });
});
test('invalid stand and unauthorized API are handled', async ({ page, request }) => {
  await page.goto('/r/missing');
  await expect(page.locator('p[role=alert]')).toContainText('unavailable');
  expect((await request.get('/api/admin/businesses')).status()).toBe(401);
  expect((await request.get('/api/admin/settings')).status()).toBe(401);
});

test('public page handles empty and HTML API failures without leaking parser errors', async ({
  page,
}) => {
  for (const body of ['', '<!DOCTYPE html><html>Internal server detail</html>']) {
    await page.route('**/api/public/stand/browser-test', (route) =>
      route.fulfill({ status: 500, contentType: 'text/html', body }),
    );
    await page.goto('/r/browser-test');
    await expect(page.locator('p[role=alert]')).toHaveText(
      'This page is temporarily unavailable. Please try again shortly.',
    );
    await expect(page.locator('p[role=alert]')).not.toContainText('JSON');
    await page.unroute('**/api/public/stand/browser-test');
  }
});
test('failed suggestion response preserves the customer editable draft', async ({ page }) => {
  await page.goto('/r/browser-test');
  await expect(page.getByRole('heading', { name: 'Shree Optical', exact: true })).toBeVisible();
  await page.getByLabel('Your review — freely editable').fill('My own genuine feedback.');
  await page.getByRole('button', { name: 'Lens quality', exact: true }).click();
  await page.route('**/suggestions', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html>Server error</html>',
    }),
  );
  await page.getByRole('button', { name: 'Generate three suggestions' }).click();
  await expect(page.locator('p[role=alert]')).toContainText('temporarily unavailable');
  await expect(page.getByLabel('Your review — freely editable')).toHaveValue(
    'My own genuine feedback.',
  );
});

test('optional category staff selection appears in editable drafts for critical feedback', async ({
  page,
}) => {
  await page.goto('/r/browser-test');
  await page.getByRole('heading', { name: 'Shree Optical', exact: true }).waitFor();
  await page
    .getByLabel('Who helped you during your visit? (optional)')
    .selectOption({ label: 'Priya · Advisor' });
  await page.getByRole('button', { name: 'Lens quality', exact: true }).click();
  await page.getByLabel('How was your experience?').selectOption('critical');
  await page.getByRole('button', { name: 'Generate three suggestions' }).click();
  await expect(page.getByLabel('Your review — freely editable')).toHaveValue(/Priya \(Advisor\)/);
  await expect(page.getByLabel('Your review — freely editable')).not.toHaveValue(
    /excellent|amazing/i,
  );
  await page.screenshot({ path: 'test-results/branded-staff-review.png', fullPage: true });
  expect(
    await page.locator('.customer-page').evaluate((e) => getComputedStyle(e).colorScheme),
  ).toBe('light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
