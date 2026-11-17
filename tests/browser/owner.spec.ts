import { test, expect } from '@playwright/test';
const owner = 'http://localhost:4319';
test('owner overview, tenant-only reports and stand QR download', async ({ page }) => {
  await page.goto(owner + '/owner');
  await expect(page.getByRole('heading', { name: 'Your business, at a glance.' })).toBeVisible();
  await expect(page.getByLabel('Your business')).toContainText('Juniper Cafe');
  await expect(page.locator('body')).not.toContainText('SECRET_OTHER_BUSINESS');
  await page.getByRole('heading', { name: 'Business inventory', exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/owner-overview-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/owner-overview-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'My Stands', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Main counter' })).toBeVisible();
  const qr = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download QR' }).click();
  expect((await qr).suggestedFilename()).toBe('stand-qr.png');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reports & insights' })).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: /CSV/ }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
});
test('owner manages optional staff and branding through real API handlers', async ({ page }) => {
  await page.goto(owner + '/owner');
  await page.getByRole('heading', { name: 'Your business, at a glance.' }).waitFor();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await page.getByLabel('Display name').fill('Rahul');
  await page.getByLabel('Role (optional)', { exact: true }).fill('Waiter');
  await page.getByRole('button', { name: 'Save staff member', exact: true }).click();
  await expect(page.getByText('Staff saved.', { exact: true })).toBeVisible();
  await page.getByLabel('Enable optional staff selection').check();
  await page.getByLabel('Question shown to customers').fill('Who looked after your table?');
  await page.getByRole('button', { name: 'Save staff settings' }).click();
  await expect(page.getByText('Staff question saved.')).toBeVisible();
  await page.getByLabel('Enable optional staff selection').uncheck();
  await page.getByLabel('Question shown to customers').fill('');
  await page.getByRole('button', { name: 'Save staff settings' }).click();
  await expect(page.getByText('Staff question saved.')).toBeVisible();
  await page.getByLabel('Enable optional staff selection').check();
  await page.getByLabel('Question shown to customers').fill('Who helped you today?');
  await page.getByRole('button', { name: 'Save staff settings' }).click();
  await expect(page.getByText('Staff question saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Edit staff', exact: true }).click();
  await page.getByLabel('Active', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save staff member', exact: true }).click();
  await expect(page.getByText('Waiter · Inactive')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete staff', exact: true }).click();
  await expect(
    page.getByText('Staff deleted. Previous mention history is preserved.'),
  ).toBeVisible();
  await expect(
    page.getByText('No staff yet. Add a member and enable staff selection to start.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Branding', exact: true }).click();
  await page.getByLabel('Welcome message').fill('Welcome to Juniper Cafe');
  await page.getByLabel('Brand colour').fill('#173e59');
  await page.getByRole('button', { name: 'Save branding' }).click();
  await expect(page.getByText('Branding saved. Your review page is updated.')).toBeVisible();
  await page.reload();
  await page.getByRole('heading', { name: 'Your business, at a glance.' }).waitFor();
  await page.getByRole('button', { name: 'Branding', exact: true }).click();
  await expect(page.getByLabel('Welcome message')).toHaveValue('Welcome to Juniper Cafe');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('yearly subscriptions, payment history, WhatsApp link and warning-only expiry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(owner + '/admin/subscriptions');
  await page.getByRole('heading', { name: 'Subscriptions & renewals' }).waitFor();
  await page.getByRole('button', { name: 'Add yearly subscription', exact: true }).first().click();
  await page.getByLabel('Starts on (UTC)').fill('2024-01-01');
  await page.getByLabel('Annual fee (INR)', { exact: true }).fill('2999');
  await page.getByRole('button', { name: 'Save subscription', exact: true }).click();
  await expect(page.getByText('Subscription saved.', { exact: true })).toBeVisible();
  const reminder = page.getByRole('link', { name: 'WhatsApp renewal reminder', exact: true });
  await expect(reminder).toHaveAttribute('href', /https:\/\/wa.me\/919999999999\?text=/);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Amount received (INR)', { exact: true }).fill('1500');
  await page.getByRole('button', { name: 'Save payment', exact: true }).click();
  await expect(page.getByText('Payment recorded.', { exact: true })).toBeVisible();
  await page.goto(owner + '/owner');
  await expect(
    page.getByText('Your yearly subscription has expired.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Subscription', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Subscription', exact: true })).toBeVisible();
  await expect(page.getByText(/2024-01-01 → 2024-12-31/)).toBeVisible();
  const response = await page.request.get(owner + '/api/public/stand/permanent-a');
  expect(response.status()).toBe(200);
  await page.goto(owner + '/admin/subscriptions?businessId=a');
  await page.getByRole('button', { name: 'Renew yearly', exact: true }).first().click();
  await page.getByLabel('Annual fee (INR)', { exact: true }).fill('3499');
  await page.getByRole('button', { name: 'Save subscription', exact: true }).click();
  await expect(page.getByText('Subscription saved.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/subscriptions-desktop.png', fullPage: true });
});

test('super admin can generate private setup link and revoke assignment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(owner + '/admin/owners');
  await page.getByRole('heading', { name: 'Business Owners', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Generate setup link' }).click();
  await expect(page.getByLabel('Setup link')).toHaveValue(
    'https://firebase.test/browser-private-setup',
  );
  await page.getByRole('button', { name: 'Hide link' }).click();
  await expect(page.getByLabel('Setup link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Revoke access' }).click();
  await expect(page.getByText('Juniper Cafe · Revoked')).toBeVisible();
  await page.goto(owner + '/owner');
  await expect(page.getByRole('heading', { name: 'No business assigned' })).toBeVisible();
});
