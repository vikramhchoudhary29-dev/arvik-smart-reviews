import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { unzipSync, strFromU8 } from 'fflate';
import { parseAnalyticsFilters, aggregateSeries } from '../lib/analytics-filters';
import {
  percent,
  emptyCounts,
  reportTable,
  selectReportRows,
  type AnalyticsSnapshot,
} from '../lib/analytics-model';
import { csvCell, reportCsv, reportXlsx } from '../lib/report-export';
const now = new Date('2026-11-12T10:15:00Z');
test('calendar presets, leap dates, inclusive custom limits and invalid filters', () => {
  for (const [preset, from, to] of [
    ['today', '2026-11-12', '2026-11-12'],
    ['last7', '2026-11-06', '2026-11-12'],
    ['last30', '2026-10-14', '2026-11-12'],
    ['month', '2026-11-01', '2026-11-12'],
  ]) {
    const f = parseAnalyticsFilters(new URLSearchParams({ preset }), now);
    assert.equal(f.from, from);
    assert.equal(f.to, to);
  }
  assert.equal(
    parseAnalyticsFilters(new URLSearchParams({ preset: 'month' }), new Date('2024-03-01T00:01Z'))
      .from,
    '2024-03-01',
  );
  for (const input of [
    { from: '2026-12-01', to: '2026-11-01' },
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2024-01-01', to: '2026-01-01' },
    { preset: 'custom', from: '2026-01-01' },
    { interval: 'invalid' },
  ])
    assert.throws(() =>
      parseAnalyticsFilters(
        new URLSearchParams(
          Object.entries(input).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        ),
        now,
      ),
    );
});
test('zero denominators remain N/A, repeated click event ratios are not capped', () => {
  assert.equal(percent(0, 0), null);
  assert.equal(percent(2, 0), null);
  assert.equal(percent(0, 2), 0);
  assert.equal(percent(3, 2), 150);
});
test('series zero-fills dates and groups Monday weeks and month boundaries', () => {
  const f = parseAnalyticsFilters(
    new URLSearchParams({ from: '2026-10-31', to: '2026-11-03' }),
    now,
  );
  const d = [
    { ...emptyCounts(), period: '2026-10-31', visits: 2 },
    { ...emptyCounts(), period: '2026-11-03', clicks: 3 },
  ];
  const series = aggregateSeries(d, f);
  assert.equal(series.length, 4);
  assert.equal(series[1].visits, 0);
  const week = aggregateSeries(d, { ...f, interval: 'weekly' });
  assert.deepEqual(
    week.map((x) => x.period),
    ['2026-10-26', '2026-11-02'],
  );
  assert.equal(week[1].clicks, 3);
  const month = aggregateSeries(d, { ...f, interval: 'monthly' });
  assert.equal(month[0].visits, 2);
  assert.equal(month[1].clicks, 3);
});
test('CSV injection escaping quotes, whitespace, commas and line breaks', () => {
  for (const s of ['=1+1', '+cmd', '-cmd', '@cmd', '  =1', '\tfoo', '\rfoo'])
    assert.ok(csvCell(s).startsWith(String.fromCharCode(34, 39)));
  assert.equal(csvCell('Acme, "Reviews"'), '"Acme, ""Reviews"""');
  assert.equal(csvCell(-2), '"-2"');
  assert.equal(csvCell(null), 'N/A');
});
test('reporting integration: real aggregate data, stable scopes and independently readable exports', async (t) => {
  const db = await PGlite.create();
  for (const migration of [
    '20261111063631_init',
    '20261112090000_complete_reviews',
    '20261112170000_analytics_time_index',
    '20261116090000_business_owner_experience',
  ])
    await db.exec(readFileSync('prisma/migrations/' + migration + '/migration.sql', 'utf8'));
  const server = new PGLiteSocketServer({ db, port: 0, maxConnections: 4 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres?connection_limit=1';
  process.env.RATE_LIMIT_SECRET = 'report-test-only';
  process.env.ADMIN_EMAILS = 'owner@example.test';
  process.env.FIREBASE_PROJECT_ID = 'local-report-test';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@local-report-test.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
  const { prisma } = await import('../lib/prisma');
  const { analyticsSnapshot } = await import('../lib/analytics-server');
  const { adminAuth } = await import('../lib/firebase-admin');
  t.mock.method(adminAuth(), 'verifyIdToken', async () => ({
    email: 'owner@example.test',
    email_verified: true,
  }));
  const { GET } = await import('../app/api/admin/reports/route');
  const ctx = { params: Promise.resolve({}) };
  try {
    for (const b of [
      { id: 'a', name: 'Alpha & Co', status: 'ACTIVE' as const },
      { id: 'b', name: '=BETA, "Shop"', status: 'INACTIVE' as const },
    ])
      await prisma.business.create({
        data: { ...b, slug: b.id, googleReviewUrl: 'https://g.page/r/' + b.id + '/review' },
      });
    for (const s of [
      { id: 's1', businessId: 'a', label: 'Counter A', active: true },
      { id: 's2', businessId: 'b', label: 'Counter B', active: true },
      { id: 's3', businessId: 'b', label: 'Quiet stand', active: false },
    ])
      await prisma.stand.create({ data: { ...s, code: s.id + '-permanent' } });
    let n = 0;
    async function event(
      businessId: string,
      standId: string | null,
      type:
        | 'PAGE_VIEW'
        | 'SUGGESTION_GENERATE'
        | 'SUGGESTION_REGENERATE'
        | 'COPY_SUGGESTION'
        | 'GOOGLE_LINK_CLICK',
      date: string,
      count = 1,
    ) {
      for (let i = 0; i < count; i++)
        await prisma.analyticsEvent.create({
          data: { id: 'fixture-' + n++, businessId, standId, type, createdAt: new Date(date) },
        });
    }
    await event('a', 's1', 'PAGE_VIEW', '2026-11-12T00:00:00Z', 2);
    await event('a', 's1', 'SUGGESTION_GENERATE', '2026-11-12T09:00Z');
    await event('a', 's1', 'SUGGESTION_REGENERATE', '2026-11-12T09:01Z');
    await event('a', 's1', 'COPY_SUGGESTION', '2026-11-12T09:02Z');
    await event('a', 's1', 'GOOGLE_LINK_CLICK', '2026-11-12T23:59:59.999Z', 3);
    await event('b', 's2', 'PAGE_VIEW', '2026-11-12T10:00Z');
    await event('b', 's2', 'COPY_SUGGESTION', '2026-11-12T10:01Z');
    await event('b', 's2', 'GOOGLE_LINK_CLICK', '2026-11-12T10:02Z');
    await event('a', null, 'COPY_SUGGESTION', '2026-11-12T10:03Z');
    await event('a', 's1', 'PAGE_VIEW', '2026-11-06T00:00Z');
    await event('a', 's1', 'GOOGLE_LINK_CLICK', '2026-11-06T00:01Z');
    await event('a', 's2', 'PAGE_VIEW', '2026-11-05T00:00Z');
    await event('a', 's2', 'GOOGLE_LINK_CLICK', '2026-11-05T00:01Z');
    await event('b', 's2', 'PAGE_VIEW', '2026-11-13T00:00Z');
    await event('a', 's1', 'PAGE_VIEW', '2026-11-01T00:00Z');
    let today: AnalyticsSnapshot;
    await t.test(
      'KPIs use one consistent range, platform inventory is all-time and independent',
      async () => {
        today = await analyticsSnapshot(new URLSearchParams({ preset: 'today' }), now);
        assert.deepEqual(today.inventory, {
          totalBusinesses: 2,
          activeBusinesses: 1,
          inactiveBusinesses: 1,
          totalStands: 3,
          activeStands: 2,
          inactiveStands: 1,
        });
        assert.deepEqual(today.activity, {
          visits: 3,
          generations: 1,
          regenerations: 1,
          copies: 3,
          clicks: 4,
          ctr: 400 / 3,
        });
        assert.equal(today.series[0].clicks, 4);
        assert.equal(today.recent.length, 12);
        assert.equal(today.templateUsage.supported, false);
      },
    );
    await t.test(
      'entity filters, historical reassignment and missing stands retain correct counts',
      async () => {
        const a = await analyticsSnapshot(
          new URLSearchParams({ preset: 'today', businessId: 'a' }),
          now,
        );
        assert.equal(a.activity.visits, 2);
        assert.equal(a.activity.ctr, 150);
        assert.deepEqual(a.inventory, today.inventory);
        assert.equal(a.businessRows.length, 1);
        assert.ok(a.standRows.some((s) => s.id === 'unassigned' && s.copies === 1));
        const historical = await analyticsSnapshot(
          new URLSearchParams({ preset: 'month', businessId: 'a', standId: 's2' }),
          now,
        );
        assert.equal(historical.activity.visits, 1);
        assert.equal(historical.standRows[0].businessName, '=BETA, "Shop"');
        assert.equal(historical.businessRows[0].name, 'Alpha & Co');
      },
    );
    await t.test('presets/custom ranges and daily/weekly/monthly rollups agree', async () => {
      const seven = await analyticsSnapshot(new URLSearchParams({ preset: 'last7' }), now);
      assert.equal(seven.activity.visits, 4);
      assert.equal(seven.activity.clicks, 5);
      const month = await analyticsSnapshot(
        new URLSearchParams({ preset: 'month', interval: 'monthly' }),
        now,
      );
      assert.equal(month.activity.visits, 6);
      assert.equal(month.series[0].visits, 6);
      const custom = await analyticsSnapshot(
        new URLSearchParams({ from: '2026-11-12', to: '2026-11-12' }),
        now,
      );
      assert.deepEqual(custom.activity, today.activity);
      assert.equal(
        custom.series.reduce((n, p) => n + p.clicks, 0),
        4,
      );
    });
    await t.test(
      'zero activity, unknown scopes, zero denominators and all exports remain valid',
      async () => {
        const empty = await analyticsSnapshot(
          new URLSearchParams({ from: '2000-01-01', to: '2000-01-02' }),
          now,
        );
        assert.equal(empty.activity.ctr, null);
        assert.equal(empty.series.length, 2);
        assert.equal(empty.series[0].visits, 0);
        assert.equal(empty.recent.length, 0);
        assert.equal(empty.businessRows.length, 2);
        const unknown = await analyticsSnapshot(
          new URLSearchParams({ preset: 'today', businessId: 'missing' }),
          now,
        );
        assert.equal(unknown.activity.visits, 0);
        assert.equal(unknown.businessRows.length, 0);
        const table = reportTable(today, 'business');
        assert.equal(selectReportRows(table, 'alpha', 'clicks', 'desc').length, 1);
        assert.equal(selectReportRows(table, '150%', 'clicks', 'desc').length, 1);
        assert.equal(selectReportRows(table, '', 'clicks', 'desc')[0].name, 'Alpha & Co');
        const csv = reportCsv(today, 'business', '', 'clicks', 'desc');
        assert.ok(csv.includes('Generated at (UTC)'));
        assert.ok(csv.includes("'=BETA"));
        assert.ok(!csv.includes('published reviews"'));
        const bytes = reportXlsx(today, 'business', '', 'clicks', 'desc');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(bytes) as any);
        assert.equal(workbook.worksheets.length, 3);
        const sheet = workbook.getWorksheet('Report')!;
        assert.equal(sheet.getRow(11).getCell(1).value, 'Business');
        assert.equal(sheet.getRow(12).getCell(1).value, 'Alpha & Co');
        assert.equal(sheet.getRow(13).getCell(1).value, '=BETA, "Shop"');
        assert.equal(typeof sheet.getRow(13).getCell(1).value, 'string');
        const ctrColumn = table.columns.findIndex((c) => c.key === 'ctr') + 1;
        assert.equal(sheet.getRow(12).getCell(ctrColumn).value, 1.5);
        assert.equal(sheet.getRow(12).getCell(ctrColumn).numFmt, '0.00%');
        const zip = unzipSync(bytes);
        assert.ok(!strFromU8(zip['xl/worksheets/sheet1.xml']).includes('<f>'));
        for (const kind of ['overview', 'stand', 'funnel', 'daily'] as const) {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(Buffer.from(reportXlsx(empty, kind, '', 'period', 'asc')) as any);
          assert.equal(wb.worksheets.length, 3);
        }
      },
    );
    await t.test(
      'export endpoint is protected, validates inputs, uses filters and returns genuine XLSX/CSV',
      async () => {
        const request = (suffix: string, token = true) =>
          new NextRequest('http://localhost:3000/api/admin/reports?' + suffix, {
            headers: token ? { Authorization: 'Bearer test' } : {},
          });
        assert.equal((await GET(request('', false), ctx)).status, 401);
        assert.equal((await GET(request('report=templates'), ctx)).status, 409);
        assert.equal((await GET(request('format=exe'), ctx)).status, 400);
        assert.equal((await GET(request('from=2026-12-01&to=2026-01-01'), ctx)).status, 400);
        const r = await GET(
          request(
            'report=business&format=xlsx&from=2026-11-12&to=2026-11-12&search=alpha&sort=clicks&direction=desc',
          ),
          ctx,
        );
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('cache-control'), 'private, no-store');
        assert.ok(r.headers.get('content-type')!.includes('spreadsheetml'));
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(Buffer.from(await r.arrayBuffer()) as any);
        assert.equal(wb.getWorksheet('Report')!.getRow(12).getCell(1).value, 'Alpha & Co');
        assert.equal(wb.getWorksheet('Report')!.getRow(13).getCell(1).value, null);
      },
    );
  } finally {
    await prisma.$disconnect();
    await server.stop();
    await db.close();
  }
});
