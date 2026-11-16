import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';

test('owner tenant isolation, staff, branding, invitations and historical preservation', async (t) => {
  const db = await PGlite.create();
  const migrations = readdirSync('prisma/migrations')
    .filter((m) => m !== 'migration_lock.toml')
    .sort();
  for (const m of migrations)
    await db.exec(readFileSync('prisma/migrations/' + m + '/migration.sql', 'utf8'));
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 4 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres?connection_limit=1';
  process.env.RATE_LIMIT_SECRET = 'owner-test';
  process.env.ADMIN_EMAILS = 'admin@example.test';
  process.env.NEXT_PUBLIC_APP_URL = 'https://reviews.test';
  process.env.FIREBASE_PROJECT_ID = 'owner-test';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@owner-test.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
  const { prisma } = await import('../lib/prisma');
  const { adminAuth } = await import('../lib/firebase-admin');
  t.mock.method(adminAuth(), 'verifyIdToken', async (token: string) => {
    if (token === 'bad') throw Error('invalid');
    return {
      uid: token === 'admin' ? 'super' : token === 'other' ? 'other-uid' : 'owner-uid',
      email: token === 'admin' ? 'admin@example.test' : 'owner@example.test',
      email_verified: token !== 'unverified',
    };
  });
  t.mock.method(adminAuth(), 'getUserByEmail', async (email: string) => ({
    uid: 'new-owner',
    email,
    disabled: false,
  }));
  t.mock.method(adminAuth(), 'getUser', async () => ({
    uid: 'new-owner',
    email: 'new@example.test',
    disabled: false,
  }));
  t.mock.method(
    adminAuth(),
    'generatePasswordResetLink',
    async () => 'https://firebase.test/private-setup',
  );
  const me = await import('../app/api/owner/me/route');
  const business = await import('../app/api/owner/business/route');
  const staff = await import('../app/api/owner/staff/route');
  const analytics = await import('../app/api/owner/analytics/route');
  const reports = await import('../app/api/owner/reports/route');
  const qr = await import('../app/api/owner/stands/[id]/qr/route');
  const upload = await import('../app/api/owner/upload/route');
  const admin = await import('../app/api/admin/owners/route');
  const invite = await import('../app/api/admin/owners/invite/route');
  const lookup = await import('../app/api/public/stand/[code]/route');
  const suggestions = await import('../app/api/public/stand/[code]/suggestions/route');
  const req = (url: string, method = 'GET', body?: unknown, token = 'owner') =>
    new NextRequest('https://reviews.test' + url, {
      method,
      headers: {
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
  try {
    for (const [id, name] of [
      ['a', 'Hotel Alpha'],
      ['b', 'SECRET_OTHER_BUSINESS'],
    ]) {
      await prisma.business.create({
        data: {
          id,
          name,
          slug: id,
          category: 'hotel',
          googleReviewUrl: 'https://g.page/r/' + id + '/review',
          status: 'ACTIVE',
          linkTestedAt: new Date(),
          internalNotes: 'private-admin-notes',
        },
      });
      await prisma.stand.create({
        data: { id: 's' + id, code: 'permanent-' + id, businessId: id, label: name + ' stand' },
      });
      await prisma.analyticsEvent.createMany({
        data: [
          { businessId: id, standId: 's' + id, type: 'PAGE_VIEW' },
          { businessId: id, standId: 's' + id, type: 'GOOGLE_LINK_CLICK' },
        ],
      });
    }
    const assignment = await prisma.businessOwner.create({
      data: { firebaseUid: 'owner-uid', email: 'owner@example.test', businessId: 'a' },
    });
    await t.test('every owner endpoint rejects anonymous/invalid/unverified accounts', async () => {
      for (const token of ['', 'bad', 'unverified'])
        for (const [fn, method, path] of [
          [me.GET, 'GET', '/api/owner/me'],
          [business.GET, 'GET', '/api/owner/business?businessId=a'],
          [business.PATCH, 'PATCH', '/api/owner/business?businessId=a'],
          [staff.POST, 'POST', '/api/owner/staff?businessId=a'],
          [analytics.GET, 'GET', '/api/owner/analytics?businessId=a'],
          [reports.GET, 'GET', '/api/owner/reports?businessId=a'],
          [qr.GET, 'GET', '/api/owner/stands/sa/qr?businessId=a'],
          [upload.POST, 'POST', '/api/owner/upload?businessId=a'],
        ] as const)
          assert.equal(
            (
              await fn(
                req(path, method, method === 'GET' ? undefined : {}, token),
                ctx({ id: 'sa' }),
              )
            ).status,
            401,
          );
    });
    await t.test('UID assignment required; matching email alone cannot gain access', async () => {
      assert.equal(
        (await me.GET(req('/api/owner/me', 'GET', undefined, 'other'), ctx())).status,
        200,
      );
      assert.equal(
        (await business.GET(req('/?businessId=a', 'GET', undefined, 'other'), ctx())).status,
        403,
      );
      const body = await (await me.GET(req('/'), ctx())).json();
      assert.equal(body.businesses.length, 1);
      assert.equal(body.businesses[0].id, 'a');
      for (const [fn, method] of [
        [business.GET, 'GET'],
        [business.PATCH, 'PATCH'],
        [staff.POST, 'POST'],
        [analytics.GET, 'GET'],
        [reports.GET, 'GET'],
        [qr.GET, 'GET'],
        [upload.POST, 'POST'],
      ] as const)
        assert.equal(
          (
            await fn(
              req('/?businessId=b', method, method === 'GET' ? undefined : {}),
              ctx({ id: 'sb' }),
            )
          ).status,
          403,
        );
      assert.equal((await qr.GET(req('/?businessId=a'), ctx({ id: 'sb' }))).status, 403);
      assert.equal((await analytics.GET(req('/?businessId=a&standId=sb'), ctx())).status, 400);
      assert.equal((await admin.GET(req('/'), ctx())).status, 401);
    });
    await t.test(
      'analytics and exports contain only assigned business inventory/options/events',
      async () => {
        const r = await analytics.GET(req('/?businessId=a'), ctx());
        assert.equal(r.status, 200);
        const a = await r.json();
        assert.equal(a.inventory.totalBusinesses, 1);
        assert.equal(a.inventory.totalStands, 1);
        assert.equal(a.activity.visits, 1);
        assert.equal(a.inventoryScope, 'business');
        assert.equal(a.options.businesses.length, 1);
        assert.equal(a.options.stands.length, 1);
        assert.ok(!JSON.stringify(a).includes('SECRET_OTHER_BUSINESS'));
        const csv = await reports.GET(req('/?businessId=a&report=stand&format=csv'), ctx());
        const text = await csv.text();
        assert.ok(text.includes('Hotel Alpha'));
        assert.ok(!text.includes('SECRET_OTHER_BUSINESS'));
        assert.equal(csv.headers.get('cache-control'), 'private, no-store');
        const xlsx = await reports.GET(req('/?businessId=a&report=stand&format=xlsx'), ctx());
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as any);
        assert.ok(!JSON.stringify(wb.model).includes('SECRET_OTHER_BUSINESS'));
        const future = await analytics.GET(
          req('/?businessId=a&preset=custom&from=2099-01-01&to=2099-01-02'),
          ctx(),
        );
        assert.equal((await future.json()).activity.visits, 0);
        assert.equal(
          (
            await reports.GET(
              req('/?businessId=a&preset=custom&from=2026-02-02&to=2026-01-01'),
              ctx(),
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      'owner branding allowlist protects identity, destination and admin notes',
      async () => {
        assert.equal(
          (
            await business.PATCH(
              req('/?businessId=a', 'PATCH', {
                kind: 'branding',
                values: {
                  logo: '',
                  brandColor: '#000000',
                  welcomeMessage: 'Welcome to Alpha',
                  googleReviewUrl: 'https://evil.test',
                },
              }),
              ctx(),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await business.PATCH(
              req('/?businessId=a', 'PATCH', {
                kind: 'branding',
                values: { logo: '', brandColor: '#ffffff', welcomeMessage: 'Welcome to Alpha' },
              }),
              ctx(),
            )
          ).status,
          200,
        );
        const b = await prisma.business.findUniqueOrThrow({ where: { id: 'a' } });
        assert.equal(b.googleReviewUrl, 'https://g.page/r/a/review');
        assert.equal(b.name, 'Hotel Alpha');
        assert.equal(b.internalNotes, 'private-admin-notes');
        assert.ok(
          !JSON.stringify(await (await business.GET(req('/?businessId=a'), ctx())).json()).includes(
            'private-admin-notes',
          ),
        );
      },
    );
    let memberId = '';
    await t.test(
      'staff configuration, category question, active public list and cross-tenant protection',
      async () => {
        const r = await staff.POST(
          req('/?businessId=a', 'POST', {
            values: { name: 'Rahul', role: 'Waiter', active: true },
          }),
          ctx(),
        );
        assert.equal(r.status, 200);
        memberId = (await r.json()).staff.id;
        const b = await prisma.staffMember.create({
          data: { businessId: 'b', name: 'Other private staff' },
        });
        assert.equal(
          (
            await staff.POST(
              req('/?businessId=a', 'POST', {
                id: b.id,
                values: { name: 'Edited', role: '', active: true },
              }),
              ctx(),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await business.PATCH(
              req('/?businessId=a', 'PATCH', {
                kind: 'experience',
                values: { staffEnabled: true, staffQuestion: '' },
              }),
              ctx(),
            )
          ).status,
          200,
        );
        const publicData = await (await lookup.GET(req('/'), ctx({ code: 'permanent-a' }))).json();
        assert.equal(publicData.staff.length, 1);
        assert.equal(publicData.staff[0].name, 'Rahul');
        assert.equal(publicData.staffQuestion, 'Who helped you during your stay?');
        assert.equal(publicData.brandColor, '#ffffff');
        assert.ok(!JSON.stringify(publicData).includes('private-admin-notes'));
      },
    );
    await t.test(
      'sentiment-neutral name attribution, no staff injection, deduplicated mentions and optional selection',
      async () => {
        const input = {
          aspects: [],
          sentiment: 'critical',
          notes: 'The wait was too long.',
          variation: 0,
          eventId: randomUUID(),
          staffId: memberId,
        };
        for (let i = 0; i < 2; i++) {
          const r = await suggestions.POST(req('/', 'POST', input), ctx({ code: 'permanent-a' }));
          assert.equal(r.status, 200);
          const j = await r.json();
          assert.equal(j.suggestions.length, 3);
          for (const draft of j.suggestions) {
            assert.ok(draft.includes('Rahul (Waiter)'));
            assert.ok(!draft.includes('excellent'));
          }
        }
        assert.equal(await prisma.staffMention.count({ where: { staffId: memberId } }), 1);
        assert.equal(
          await prisma.analyticsEvent.count({
            where: { businessId: 'a', type: 'SUGGESTION_GENERATE' },
          }),
          1,
        );
        const other = await prisma.staffMember.findFirstOrThrow({ where: { businessId: 'b' } });
        assert.equal(
          (
            await suggestions.POST(
              req('/', 'POST', { ...input, eventId: randomUUID(), staffId: other.id }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await suggestions.POST(
              req('/', 'POST', { ...input, eventId: randomUUID(), staffName: 'invented' }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        const { staffId, ...optional } = input;
        const r = await suggestions.POST(
          req('/', 'POST', { ...optional, eventId: randomUUID() }),
          ctx({ code: 'permanent-a' }),
        );
        assert.equal(r.status, 200);
        assert.ok(!(await r.text()).includes('Rahul'));
        const detail = await (await business.GET(req('/?businessId=a'), ctx())).json();
        assert.equal(detail.staff[0].mentions, 1);
        await staff.POST(
          req('/?businessId=a', 'POST', {
            id: memberId,
            values: { name: 'Rahul', role: 'Waiter', active: false },
          }),
          ctx(),
        );
        assert.equal(
          (
            await suggestions.POST(
              req('/', 'POST', { ...input, eventId: randomUUID() }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        assert.equal(
          (await (await lookup.GET(req('/'), ctx({ code: 'permanent-a' }))).json()).staff.length,
          0,
        );
        assert.equal(await prisma.staffMention.count(), 1);
      },
    );
    await t.test(
      'assignment grants, private setup link, audit and immediate revocation',
      async () => {
        assert.equal(
          (
            await admin.POST(
              req('/', 'POST', { email: 'new@example.test', businessId: 'b' }, 'admin'),
              ctx(),
            )
          ).status,
          200,
        );
        const grant = await prisma.businessOwner.findUniqueOrThrow({
          where: { firebaseUid_businessId: { firebaseUid: 'new-owner', businessId: 'b' } },
        });
        const r = await invite.POST(req('/', 'POST', { id: grant.id }, 'admin'), ctx());
        assert.equal(r.status, 200);
        assert.equal(r.headers.get('cache-control'), 'private, no-store');
        assert.ok((await r.json()).setupLink.includes('private-setup'));
        assert.ok(!JSON.stringify(await prisma.adminAudit.findMany()).includes('private-setup'));
        assert.equal(
          (
            await admin.PATCH(
              req('/', 'PATCH', { id: assignment.id, active: false }, 'admin'),
              ctx(),
            )
          ).status,
          200,
        );
        assert.equal((await business.GET(req('/?businessId=a'), ctx())).status, 403);
        assert.equal((await reports.GET(req('/?businessId=a'), ctx())).status, 403);
        assert.equal((await qr.GET(req('/?businessId=a'), ctx({ id: 'sa' }))).status, 403);
        assert.equal(
          (await prisma.stand.findUniqueOrThrow({ where: { id: 'sa' } })).code,
          'permanent-a',
        );
        assert.equal(await prisma.business.count(), 2);
      },
    );
    await t.test('migration-pending public lookups retain existing review workflow', async () => {
      await db.exec('DROP TABLE "BusinessExperience"');
      const r = await lookup.GET(req('/'), ctx({ code: 'permanent-a' }));
      assert.equal(r.status, 200);
      const j = await r.json();
      assert.equal(j.staffEnabled, false);
      assert.deepEqual(j.staff, []);
    });
  } finally {
    await prisma.$disconnect();
    await server.stop();
    await db.close();
  }
});
