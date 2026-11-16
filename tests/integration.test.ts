import sharp from 'sharp';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
test('isolated PostgreSQL migrations, owner APIs and public journey', async (t) => {
  const db = await PGlite.create();
  await db.exec(readFileSync('prisma/migrations/20261111063631_init/migration.sql', 'utf8'));
  await db.exec(
    `INSERT INTO "Business" (id,name,slug,"googleReviewUrl","updatedAt") VALUES ('legacy','Legacy','legacy','https://g.page/r/legacy/review',now()); INSERT INTO "Stand" (id,"businessId",code) VALUES ('legacy-stand','legacy','permanent-old-code');`,
  );
  await db.exec(
    readFileSync('prisma/migrations/20261112090000_complete_reviews/migration.sql', 'utf8'),
  );
  await db.exec(
    readFileSync('prisma/migrations/20261112170000_analytics_time_index/migration.sql', 'utf8'),
  );
  await db.exec(
    readFileSync(
      'prisma/migrations/20261116090000_business_owner_experience/migration.sql',
      'utf8',
    ),
  );
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres?connection_limit=1';
  process.env.RATE_LIMIT_SECRET = 'isolated-test-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'https://reviews.test';
  process.env.ADMIN_EMAILS = 'owner@example.test';
  process.env.FIREBASE_PROJECT_ID = 'local-test';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@local-test.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
  const { prisma } = await import('../lib/prisma');
  const { adminAuth } = await import('../lib/firebase-admin');
  t.mock.method(adminAuth(), 'verifyIdToken', async (token: string) => {
    if (token === 'owner') return { email: 'owner@example.test', email_verified: true };
    if (token === 'stranger') return { email: 'other@example.test', email_verified: true };
    if (token === 'unverified') return { email: 'owner@example.test', email_verified: false };
    throw Error('Invalid token');
  });
  const business = await import('../app/api/admin/businesses/route');
  const businessId = await import('../app/api/admin/businesses/[id]/route');
  const stands = await import('../app/api/admin/stands/route');
  const standId = await import('../app/api/admin/stands/[id]/route');
  const lookup = await import('../app/api/public/stand/[code]/route');
  const events = await import('../app/api/public/stand/[code]/event/route');
  const suggestions = await import('../app/api/public/stand/[code]/suggestions/route');
  const templates = await import('../app/api/admin/templates/route');
  const templateId = await import('../app/api/admin/templates/[id]/route');
  const analytics = await import('../app/api/admin/analytics/route');
  const upload = await import('../app/api/admin/upload/route');
  const media = await import('../app/api/media/[id]/route');
  const qr = await import('../app/api/admin/stands/[id]/qr/route');
  const settings = await import('../app/api/admin/settings/route');
  const req = (url: string, method = 'GET', body?: unknown, token = 'owner') =>
    new NextRequest('http://localhost:3000' + url, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
  try {
    await t.test('incremental migration preserves business and permanent stand code', async () => {
      assert.equal(
        (await prisma.stand.findUniqueOrThrow({ where: { id: 'legacy-stand' } })).code,
        'permanent-old-code',
      );
      assert.equal((await lookup.GET(req('/'), ctx({ code: 'permanent-old-code' }))).status, 404);
    });
    await t.test(
      'missing, invalid, nonallowlisted and unverified owner tokens rejected',
      async () => {
        for (const token of ['', 'bad', 'stranger', 'unverified'])
          assert.equal((await business.GET(req('/', 'GET', undefined, token), ctx())).status, 401);
      },
    );
    await t.test('every protected API rejects anonymous callers', async () => {
      for (const [handler, method] of [
        [business.POST, 'POST'],
        [businessId.GET, 'GET'],
        [businessId.PATCH, 'PATCH'],
        [businessId.DELETE, 'DELETE'],
        [stands.GET, 'GET'],
        [stands.POST, 'POST'],
        [standId.PATCH, 'PATCH'],
        [templates.GET, 'GET'],
        [templates.POST, 'POST'],
        [templateId.PATCH, 'PATCH'],
        [templateId.DELETE, 'DELETE'],
        [analytics.GET, 'GET'],
        [settings.GET, 'GET'],
        [settings.PATCH, 'PATCH'],
        [upload.POST, 'POST'],
        [qr.GET, 'GET'],
      ] as const)
        assert.equal(
          (await handler(req('/api/admin/test', method, undefined, ''), ctx({ id: 'missing' })))
            .status,
          401,
        );
    });
    let id = '',
      sid = '',
      code = '';
    await t.test('business create validates URL and activation confirmation', async () => {
      assert.equal(
        (
          await business.POST(
            req('/', 'POST', { name: 'Bad', slug: 'bad', googleReviewUrl: 'https://evil.test' }),
            ctx(),
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await business.POST(
            req('/', 'POST', {
              name: 'Bad',
              slug: 'bad',
              googleReviewUrl: 'https://g.page/r/a/review',
              status: 'ACTIVE',
            }),
            ctx(),
          )
        ).status,
        400,
      );
      const r = await business.POST(
        req('/', 'POST', {
          name: 'Test Optical',
          slug: 'test-optical',
          category: 'optical',
          googleReviewUrl: 'https://g.page/r/optical/review',
          status: 'ACTIVE',
          linkTested: true,
        }),
        ctx(),
      );
      assert.equal(r.status, 201);
      id = (await r.json()).business.id;
      assert.equal(
        (
          await business.POST(
            req('/', 'POST', {
              name: 'Duplicate',
              slug: 'test-optical',
              googleReviewUrl: 'https://g.page/r/a/review',
            }),
            ctx(),
          )
        ).status,
        409,
      );
    });
    await t.test('edit branding and create/reassign stand preserves code', async () => {
      assert.equal(
        (
          await businessId.PATCH(
            req('/', 'PATCH', { welcomeMessage: 'Welcome', brandColor: '#123456' }),
            ctx({ id }),
          )
        ).status,
        200,
      );
      const r = await stands.POST(
        req('/', 'POST', { businessId: id, label: 'Counter', location: 'Front', type: 'NFC_QR' }),
        ctx(),
      );
      assert.equal(r.status, 201);
      const updated = await prisma.business.findUniqueOrThrow({ where: { id } });
      assert.equal(updated.status, 'ACTIVE');
      assert.ok(updated.linkTestedAt);
      const s = (await r.json()).stand;
      sid = s.id;
      code = s.code;
      assert.match(code, /^[a-f0-9]{32}$/);
      await standId.PATCH(req('/', 'PATCH', { businessId: 'legacy' }), ctx({ id: sid }));
      await standId.PATCH(
        req('/', 'PATCH', { businessId: id, label: 'Updated' }),
        ctx({ id: sid }),
      );
      assert.equal((await prisma.stand.findUniqueOrThrow({ where: { id: sid } })).code, code);
    });
    await t.test('idempotent starter seed and real active phrase generation', async () => {
      const { seed } = await import('../lib/seed');
      for (let i = 0; i < 2; i++) await seed(prisma);
      assert.equal(await prisma.reviewPhrase.count(), 99);
      const r = await lookup.GET(req('/'), ctx({ code }));
      assert.equal((await r.json()).businessName, 'Test Optical');
      const result = await suggestions.POST(
        req('/', 'POST', {
          aspects: ['Lens quality', 'Pricing'],
          sentiment: 'critical',
          notes: 'My own experience.',
          variation: 0,
          eventId: randomUUID(),
        }),
        ctx({ code }),
      );
      assert.equal(result.status, 200);
      const drafts = (await result.json()).suggestions;
      assert.equal(drafts.length, 3);
      assert.ok(drafts[2].includes('My own experience.'));
      assert.equal(
        (
          await suggestions.POST(
            req('/', 'POST', {
              aspects: ['Invented'],
              sentiment: 'neutral',
              notes: '',
              variation: 0,
              eventId: randomUUID(),
            }),
            ctx({ code }),
          )
        ).status,
        400,
      );
    });
    await t.test('template CRUD and disabled phrases excluded', async () => {
      let r = await templates.POST(
        req('/', 'POST', {
          category: 'optical',
          tag: 'Pricing',
          sentiment: 'neutral',
          text: 'My {aspect} feedback.',
          active: true,
        }),
        ctx(),
      );
      assert.equal(r.status, 201);
      const tid = (await r.json()).template.id;
      await templateId.PATCH(req('/', 'PATCH', { active: false }), ctx({ id: tid }));
      await templateId.PATCH(
        req('/', 'PATCH', { text: 'Updated {aspect} feedback.' }),
        ctx({ id: tid }),
      );
      assert.equal(
        (await prisma.reviewPhrase.findUniqueOrThrow({ where: { id: tid } })).active,
        false,
      );
      assert.equal((await templateId.DELETE(req('/', 'DELETE'), ctx({ id: tid }))).status, 200);
    });
    await t.test('event deduplication, accurate date filters, no stored review text', async () => {
      const eventId = randomUUID();
      for (let i = 0; i < 2; i++)
        assert.equal(
          (await events.POST(req('/', 'POST', { type: 'COPY_SUGGESTION', eventId }), ctx({ code })))
            .status,
          200,
        );
      assert.equal(
        await prisma.analyticsEvent.count({ where: { standId: sid, type: 'COPY_SUGGESTION' } }),
        1,
      );
      const r = await analytics.GET(req('/?businessId=' + id), ctx());
      assert.equal(r.status, 200);
      const report = await r.json();
      assert.equal(report.totals.find((r: any) => r.type === 'COPY_SUGGESTION')._count, 1);
      assert.ok(report.daily.length);
      const empty = await analytics.GET(req('/?from=2000-01-01&to=2000-01-02'), ctx());
      assert.equal((await empty.json()).totals.length, 0);
      assert.equal(
        (await analytics.GET(req('/?from=2026-12-01&to=2026-01-01'), ctx())).status,
        400,
      );
      assert.equal(
        (await events.POST(req('/', 'POST', { type: 'PUBLISHED_REVIEW', eventId }), ctx({ code })))
          .status,
        400,
      );
    });
    await t.test('upload real PNG, read safe media and reject SVG', async () => {
      const body = new FormData();
      body.set(
        'file',
        new File(
          [
            new Uint8Array(
              await sharp({ create: { width: 10, height: 10, channels: 3, background: '#00ff00' } })
                .png()
                .toBuffer(),
            ),
          ],
          'logo.png',
          { type: 'image/png' },
        ),
      );
      let r = await upload.POST(
        new NextRequest('http://localhost:3000/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: 'Bearer owner' },
          body,
        }),
        ctx(),
      );
      assert.equal(r.status, 201);
      const url = (await r.json()).url;
      const mid = url.split('/').at(-1);
      r = await media.GET(req(url), ctx({ id: mid }));
      assert.equal(r.headers.get('content-type'), 'image/webp');
      const bad = new FormData();
      bad.set('file', new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }));
      assert.equal(
        (
          await upload.POST(
            new NextRequest('http://localhost:3000/api/admin/upload', {
              method: 'POST',
              headers: { Authorization: 'Bearer owner' },
              body: bad,
            }),
            ctx(),
          )
        ).status,
        400,
      );
    });
    await t.test('QR exports encode stable platform URL', async () => {
      const svg = await qr.GET(req('/?format=svg'), ctx({ id: sid }));
      assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
      assert.ok((await svg.text()).includes('<svg'));
      const png = await qr.GET(req('/?format=png'), ctx({ id: sid }));
      assert.equal(png.headers.get('content-type'), 'image/png');
      const buffer = Buffer.from(await png.arrayBuffer());
      assert.ok(buffer.byteLength > 1000);
      const decoded = PNG.sync.read(buffer);
      assert.equal(
        jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height)?.data,
        'https://reviews.test/r/' + code,
      );
    });
    await t.test(
      'settings, inactive stand and inactive business handling; history guarded',
      async () => {
        assert.equal(
          (
            await settings.PATCH(
              req('/', 'PATCH', { supportEmail: 'support@example.test', retentionDays: 30 }),
              ctx(),
            )
          ).status,
          200,
        );
        await standId.PATCH(req('/', 'PATCH', { active: false }), ctx({ id: sid }));
        assert.equal((await lookup.GET(req('/'), ctx({ code }))).status, 404);
        await standId.PATCH(req('/', 'PATCH', { active: true }), ctx({ id: sid }));
        await businessId.PATCH(req('/', 'PATCH', { status: 'INACTIVE' }), ctx({ id }));
        assert.equal((await lookup.GET(req('/'), ctx({ code }))).status, 404);
        assert.equal((await businessId.DELETE(req('/', 'DELETE'), ctx({ id }))).status, 409);
        assert.equal((await lookup.GET(req('/'), ctx({ code: 'missing' }))).status, 404);
      },
    );
    await t.test('shared rate limit persists and origin mismatch blocked', async () => {
      const { limited } = await import('../lib/http');
      assert.equal(await limited(req('/'), 'test-limit', 1), false);
      assert.equal(await limited(req('/'), 'test-limit', 1), true);
      const r = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer owner',
          Origin: 'https://evil.test',
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      assert.equal((await settings.PATCH(r, ctx())).status, 403);
      assert.ok(
        (await prisma.adminAudit.count({ where: { actorEmail: 'owner@example.test' } })) > 0,
      );
      assert.equal(
        (
          await settings.PATCH(
            req('/', 'PATCH', { supportEmail: 'x'.repeat(33000), retentionDays: 90 }),
            ctx(),
          )
        ).status,
        413,
      );
    });
  } finally {
    await prisma.$disconnect();
    await server.stop();
    await db.close();
  }
});
