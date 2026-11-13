import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
const base = 'http://127.0.0.1:4318';
test('premium dashboard desktop/mobile layouts, truthful KPIs and filters', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(base + '/dashboard');
  await expect(page.getByRole('heading', { name: 'Your platform, at a glance.' })).toBeVisible();
  await expect(page.getByLabel('Total Businesses', { exact: true })).toContainText('24');
  await expect(page.getByLabel('Total Review Page Visits', { exact: true })).toContainText('1,800');
  await expect(page.getByLabel('Google Review Page Clicks', { exact: true })).toContainText(
    '1,080',
  );
  await expect(page.getByLabel('Google Click-Through Rate', { exact: true })).toContainText('60%');
  await page.screenshot({ path: 'test-results/task5-dashboard-desktop.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('last7');
  await expect(page.getByRole('status')).toContainText('Filters changed');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByLabel('Total Review Page Visits', { exact: true })).toContainText('420');
  await expect(page.getByLabel('Total Businesses', { exact: true })).toContainText('24');
  await page
    .getByRole('combobox', { name: 'Business', exact: true })
    .selectOption('fixture-business-0');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.locator('.applied-filter-line')).toContainText('Shree Optical');
  await page.getByRole('combobox', { name: 'Stand', exact: true }).selectOption('fixture-stand-0');
  await page.getByRole('combobox', { name: 'Trend interval', exact: true }).selectOption('weekly');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.locator('.applied-filter-line')).toContainText('Main counter');
  await expect(page.getByLabel('Total Businesses', { exact: true })).toContainText('24');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Total Review Page Visits', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/task5-dashboard-mobile.png', fullPage: true });
});
test('reports search/sort, genuine CSV/XLSX exports, unsupported templates and empty state', async ({
  page,
}) => {
  await page.goto(base + '/reports');
  await page.getByRole('tab', { name: 'Businesses', exact: true }).click();
  await page.getByLabel('Search report', { exact: true }).fill('Shree');
  await expect(page.locator('.report-data tbody tr')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('visits');
  await page.getByRole('combobox', { name: 'Order', exact: true }).selectOption('asc');
  for (const format of ['CSV', 'Excel']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: format + ' export', exact: true }).click();
    const download = await downloadPromise;
    const filename = await download.path();
    expect(filename).toBeTruthy();
    if (format === 'CSV') {
      const text = readFileSync(filename!, 'utf8');
      expect(text).toContain('Shree Optical');
      expect(text).toContain('Generated at (UTC)');
      expect(text).not.toContain('Juniper Cafe');
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filename!);
      expect(wb.worksheets).toHaveLength(3);
      expect(wb.getWorksheet('Report')!.getRow(12).getCell(1).value).toBe('Shree Optical');
    }
  }
  await page.getByRole('tab', { name: 'Template usage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Template usage is not recorded' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excel export', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('custom');
  await page.getByLabel('From (UTC)', { exact: true }).fill('2000-01-01');
  await page.getByLabel('To (UTC)', { exact: true }).fill('2000-01-02');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.locator('.report-summary-strip')).toContainText('0');
  await page.getByRole('tab', { name: 'Date-wise activity', exact: true }).click();
  await expect(page.locator('.chart-empty')).toContainText('No visits');
  await page.getByLabel('Search report', { exact: true }).fill('no-such-record');
  await expect(page.locator('.report-data')).toContainText('No matching rows');
  await page.screenshot({ path: 'test-results/task5-empty-report.png', fullPage: true });
});
test('A4 print contains every filtered row with metadata and multipage-safe tables', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/reports');
  await page.getByRole('tab', { name: 'Stands', exact: true }).click();
  await expect(page.locator('.report-data tbody tr')).toHaveCount(15);
  await page.screenshot({ path: 'test-results/task5-reports-desktop.png', fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.report-print-only')).toBeVisible();
  await expect(page.locator('.report-print-only tbody tr')).toHaveCount(24);
  await expect(page.locator('.report-print-only header')).toContainText('UTC');
  const bytes = await page.pdf({
    path: 'test-results/task5-a4-report.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  for (const p of pdf.getPages()) {
    expect(Math.abs(p.getWidth() - 841.89)).toBeLessThan(2);
    expect(Math.abs(p.getHeight() - 595.28)).toBeLessThan(2);
  }
  await page.screenshot({ path: 'test-results/task5-print-preview.png', fullPage: true });
});

test('loading skeleton and recoverable API errors are visible', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  let fail = false;
  await page.route(base + '/snapshot?**', async (route) => {
    if (first) {
      first = false;
      await gate;
    }
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary test outage' }),
      });
    } else await route.continue();
  });
  await page.goto(base + '/reports');
  await expect(page.getByRole('status', { name: 'Loading analytics' })).toBeVisible();
  release();
  await expect(page.locator('.report-summary-strip')).toBeVisible();
  fail = true;
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('today');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary test outage');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.report-summary-strip')).toBeVisible();
});
