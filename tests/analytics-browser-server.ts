import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { z } from 'zod';
async function main() {
  const db = await PGlite.create();
  for (const m of [
    '20261111063631_init',
    '20261112090000_complete_reviews',
    '20261112170000_analytics_time_index',
    '20261116090000_business_owner_experience',
    '20261117090000_yearly_subscriptions_staff_removal',
  ])
    await db.exec(readFileSync('prisma/migrations/' + m + '/migration.sql', 'utf8'));
  const socket = new PGLiteSocketServer({ db, port: 0, maxConnections: 2 });
  await socket.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
  const { prisma } = await import('../lib/prisma');
  const { analyticsSnapshot } = await import('../lib/analytics-server');
  const { reportCsv, reportXlsx } = await import('../lib/report-export');
  const { reportKinds } = await import('../lib/analytics-model');
  for (let i = 0; i < 24; i++) {
    const name =
      ['Shree Optical', 'Horizon Stays', 'Juniper Cafe'][i] ||
      'Business ' + String(i + 1).padStart(2, '0');
    await prisma.business.create({
      data: {
        id: 'fixture-business-' + i,
        name,
        slug: 'fixture-' + i,
        status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
        googleReviewUrl: 'https://g.page/r/fixture/review',
      },
    });
    await prisma.stand.create({
      data: {
        id: 'fixture-stand-' + i,
        code: 'permanent-fixture-' + i,
        businessId: 'fixture-business-' + i,
        label: name + ' · Main counter',
        active: i % 4 !== 0,
      },
    });
  }
  const events: {
    businessId: string;
    standId: string;
    type:
      | 'PAGE_VIEW'
      | 'SUGGESTION_GENERATE'
      | 'SUGGESTION_REGENERATE'
      | 'COPY_SUGGESTION'
      | 'GOOGLE_LINK_CLICK';
    createdAt: Date;
  }[] = [];
  for (let day = 0; day < 30; day++) {
    const createdAt = new Date();
    createdAt.setUTCDate(createdAt.getUTCDate() - day);
    createdAt.setUTCHours(10, 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const item = {
        businessId: 'fixture-business-' + i,
        standId: 'fixture-stand-' + i,
        createdAt,
      };
      for (let n = 0; n < ((i + day) % 4) + 1; n++) events.push({ ...item, type: 'PAGE_VIEW' });
      events.push({ ...item, type: 'SUGGESTION_GENERATE' });
      if ((i + day) % 3 === 0) events.push({ ...item, type: 'SUGGESTION_REGENERATE' });
      if ((i + day) % 2 === 0) events.push({ ...item, type: 'COPY_SUGGESTION' });
      for (let n = 0; n < (i * 2 + day) % 4; n++)
        events.push({ ...item, type: 'GOOGLE_LINK_CLICK' });
    }
  }
  await prisma.analyticsEvent.createMany({ data: events });
  const bundle = await build({
    entryPoints: ['tests/fixtures/analytics-entry.tsx'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    tsconfig: 'tsconfig.json',
  });
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analytics isolated component test</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://127.0.0.1:4318');
      if (url.pathname === '/bundle.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(bundle.outputFiles[0].contents);
        return;
      }
      if (url.pathname === '/style.css') {
        res.setHeader('Content-Type', 'text/css');
        res.end(readFileSync('app/globals.css', 'utf8').replace('@import "tailwindcss";', ''));
        return;
      }
      if (url.pathname === '/snapshot' || url.pathname === '/export') {
        const data = await analyticsSnapshot(url.searchParams);
        if (url.pathname === '/snapshot') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return;
        }
        const kind = z.enum(reportKinds).parse(url.searchParams.get('report'));
        const query = url.searchParams.get('search') || '',
          sort = url.searchParams.get('sort') || 'name',
          direction = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
        const xlsx = url.searchParams.get('format') === 'xlsx';
        res.setHeader(
          'Content-Type',
          xlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
        );
        res.end(
          xlsx
            ? Buffer.from(reportXlsx(data, kind, query, sort, direction))
            : reportCsv(data, kind, query, sort, direction),
        );
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Test fixture error' }));
    }
  });
  await new Promise<void>((resolve) => http.listen(4318, '127.0.0.1', resolve));
  console.log('Isolated analytics component test fixture listening on 4318');
  const stop = async () => {
    http.close();
    await prisma.$disconnect();
    await socket.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main();
