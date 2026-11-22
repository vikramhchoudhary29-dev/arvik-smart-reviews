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
  const subscriptions = await import('../app/api/admin/subscriptions/route');
  const payments = await import('../app/api/admin/subscriptions/payments/route');
  const ownerSubscription = await import('../app/api/owner/subscription/route');
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
      'saved staff settings round-trip accepts disabled, blank and custom questions',
      async () => {
        for (const values of [
          { staffEnabled: false, staffQuestion: '' },
          { staffEnabled: true, staffQuestion: 'Who served you?' },
          { staffEnabled: true, staffQuestion: '' },
        ]) {
          assert.equal(
            (
              await business.PATCH(
                req('/?businessId=a', 'PATCH', { kind: 'experience', values }),
                ctx(),
              )
            ).status,
            200,
          );
          const dto = await (await business.GET(req('/?businessId=a'), ctx())).json();
          assert.deepEqual(Object.keys(dto.settings).sort(), ['staffEnabled', 'staffQuestion']);
          assert.deepEqual(dto.settings, values);
          assert.equal(
            (
              await business.PATCH(
                req('/?businessId=a', 'PATCH', { kind: 'experience', values: dto.settings }),
                ctx(),
              )
            ).status,
            200,
          );
        }
      },
    );
    await t.test(
      'delete staff removes selection while retaining mentions and denying cross-tenant/deleted edits',
      async () => {
        const other = await prisma.staffMember.findFirstOrThrow({ where: { businessId: 'b' } });
        assert.equal(
          (await staff.DELETE(req('/?businessId=a', 'DELETE', { id: other.id }), ctx())).status,
          403,
        );
        assert.equal(
          (await staff.DELETE(req('/?businessId=a', 'DELETE', { id: memberId }), ctx())).status,
          200,
        );
        const removed = await prisma.staffMember.findUniqueOrThrow({ where: { id: memberId } });
        assert.ok(removed.deletedAt);
        assert.equal(removed.active, false);
        assert.equal(await prisma.staffMention.count({ where: { staffId: memberId } }), 1);
        const dto = await (await business.GET(req('/?businessId=a'), ctx())).json();
        assert.ok(!dto.staff.some((s: any) => s.id === memberId));
        assert.equal(
          (
            await staff.POST(
              req('/?businessId=a', 'POST', {
                id: memberId,
                values: { name: 'restore', role: '', active: true },
              }),
              ctx(),
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'yearly subscription/payment management is admin-only and expiry never pauses reviews',
      async () => {
        const input = {
          action: 'create',
          businessId: 'a',
          startsOn: '2024-02-29',
          annualFeePaise: 299900,
          notes: 'private_subscription_note',
        };
        assert.equal((await subscriptions.POST(req('/', 'POST', input), ctx())).status, 401);
        const response = await subscriptions.POST(req('/', 'POST', input, 'admin'), ctx());
        assert.equal(response.status, 200);
        const term = (await response.json()).subscription;
        assert.equal(term.expiresOn, '2025-02-28');
        assert.equal(
          (
            await subscriptions.POST(
              req('/', 'POST', { ...input, startsOn: '2024-03-01' }, 'admin'),
              ctx(),
            )
          ).status,
          400,
        );
        let ownerData = await (await ownerSubscription.GET(req('/?businessId=a'), ctx())).json();
        assert.equal(ownerData.current.status, 'EXPIRED');
        assert.equal(ownerData.reviewPagePolicy, 'WARNING_ONLY');
        assert.ok(!JSON.stringify(ownerData).includes('private_subscription_note'));
        assert.equal((await ownerSubscription.GET(req('/?businessId=b'), ctx())).status, 403);
        assert.equal((await lookup.GET(req('/'), ctx({ code: 'permanent-a' }))).status, 200);
        const payment = {
          subscriptionId: term.id,
          amountPaise: 150000,
          paidOn: '2026-01-01',
          method: 'UPI',
          reference: 'private_reference',
        };
        assert.equal((await payments.POST(req('/', 'POST', payment), ctx())).status, 401);
        assert.equal((await payments.POST(req('/', 'POST', payment, 'admin'), ctx())).status, 200);
        ownerData = await (await ownerSubscription.GET(req('/?businessId=a'), ctx())).json();
        assert.equal(ownerData.current.paymentStatus, 'PARTIAL');
        assert.equal(ownerData.current.duePaise, 149900);
        assert.ok(!JSON.stringify(ownerData).includes('private_reference'));
        assert.equal(
          (
            await payments.POST(
              req('/', 'POST', { ...payment, amountPaise: 150000 }, 'admin'),
              ctx(),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await subscriptions.PATCH(
              req('/', 'PATCH', { id: term.id, annualFeePaise: 100, notes: '' }, 'admin'),
              ctx(),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await payments.POST(
              req('/', 'POST', { ...payment, amountPaise: 149900 }, 'admin'),
              ctx(),
            )
          ).status,
          200,
        );
        const paid = await (await ownerSubscription.GET(req('/?businessId=a'), ctx())).json();
        assert.equal(paid.current.paymentStatus, 'PAID');
        const pay = await prisma.subscriptionPayment.findFirstOrThrow({
          where: { subscriptionId: term.id },
        });
        assert.equal(
          (await payments.DELETE(req('/', 'DELETE', { id: pay.id }, 'admin'), ctx())).status,
          200,
        );
        assert.ok(
          (await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: pay.id } })).voidedAt,
        );
        assert.equal(
          (
            await subscriptions.POST(
              req(
                '/',
                'POST',
                { action: 'renew', businessId: 'a', annualFeePaise: 349900, notes: '' },
                'admin',
              ),
              ctx(),
            )
          ).status,
          200,
        );
        assert.equal(await prisma.subscriptionPeriod.count({ where: { businessId: 'a' } }), 2);
        const renewed = await (await ownerSubscription.GET(req('/?businessId=a'), ctx())).json();
        assert.equal(renewed.current.status, 'ACTIVE');
        assert.equal(renewed.current.annualFeePaise, 349900);
      },
    );
    await t.test(
      'outlets isolate tenants, scope staff and retain one Google destination with deduplicated events',
      async () => {
        const ownerOutlets = await import('../app/api/owner/outlets/route');
        const adminOutlets = await import('../app/api/admin/outlets/route');
        const events = await import('../app/api/public/stand/[code]/event/route');
        assert.equal(
          (await ownerOutlets.GET(req('/?businessId=a', 'GET', undefined, ''), ctx())).status,
          401,
        );
        assert.equal((await adminOutlets.GET(req('/?businessId=a'), ctx())).status, 401);
        assert.equal((await ownerOutlets.GET(req('/?businessId=b'), ctx())).status, 403);
        assert.equal(
          (
            await ownerOutlets.POST(
              req('/?businessId=a', 'POST', {
                action: 'save',
                values: { name: 'Coffee Counter', category: 'cafe', active: true },
              }),
              ctx(),
            )
          ).status,
          200,
        );
        const outlet = await prisma.outlet.findFirstOrThrow({ where: { businessId: 'a' } });
        const foreign = await prisma.outlet.create({
          data: { businessId: 'b', name: 'Private Bar', category: 'bar' },
        });
        assert.equal(
          (
            await ownerOutlets.POST(
              req('/?businessId=a', 'POST', {
                action: 'save',
                id: foreign.id,
                values: { name: 'Attack', category: 'bar', active: true },
              }),
              ctx(),
            )
          ).status,
          403,
        );
        const member = await prisma.staffMember.create({
          data: { businessId: 'a', name: 'Cafe Staff', outletId: outlet.id },
        });
        await prisma.businessExperience.upsert({
          where: { businessId: 'a' },
          create: { businessId: 'a', staffEnabled: true },
          update: { staffEnabled: true },
        });
        assert.equal(
          (
            await ownerOutlets.POST(
              req('/?businessId=a', 'POST', {
                action: 'stand',
                standId: 'sa',
                outletId: foreign.id,
              }),
              ctx(),
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await ownerOutlets.POST(
              req('/?businessId=a', 'POST', {
                action: 'stand',
                standId: 'sa',
                outletId: outlet.id,
              }),
              ctx(),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await ownerOutlets.POST(
              req('/?businessId=a', 'POST', {
                action: 'staff',
                staffId: member.id,
                outletId: foreign.id,
              }),
              ctx(),
            )
          ).status,
          403,
        );
        const publicData = await (await lookup.GET(req('/'), ctx({ code: 'permanent-a' }))).json();
        assert.equal(publicData.defaultOutletId, outlet.id);
        assert.equal(publicData.googleReviewUrl, 'https://g.page/r/a/review');
        assert.equal(publicData.outlets[0].staff[0].name, 'Cafe Staff');
        assert.ok(publicData.outlets[0].aspects.includes('Coffee'));
        assert.ok(!JSON.stringify(publicData).includes('Private Bar'));
        await prisma.reviewPhrase.create({
          data: {
            category: 'general',
            tag: '*',
            sentiment: 'neutral',
            text: 'My experience with {aspect} was mixed.',
          },
        });
        const eventId = randomUUID();
        const body = {
          outletId: outlet.id,
          staffId: member.id,
          aspects: ['Coffee'],
          sentiment: 'neutral',
          notes: '',
          variation: 0,
          eventId,
        };
        for (let i = 0; i < 2; i++) {
          const response = await suggestions.POST(
            req('/', 'POST', body),
            ctx({ code: 'permanent-a' }),
          );
          assert.equal(response.status, 200);
          assert.ok(
            (await response.json()).suggestions.every(
              (d: string) => d.includes('Coffee Counter') && d.includes('Cafe Staff'),
            ),
          );
        }
        assert.equal(
          await prisma.analyticsEvent.count({
            where: { outletId: outlet.id, type: 'SUGGESTION_GENERATE' },
          }),
          1,
        );
        assert.equal(
          (
            await suggestions.POST(
              req('/', 'POST', { ...body, outletId: foreign.id }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await suggestions.POST(
              req('/', 'POST', { ...body, outletId: undefined }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        const clickId = randomUUID();
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await events.POST(
                req('/', 'POST', {
                  type: 'GOOGLE_LINK_CLICK',
                  eventId: clickId,
                  outletId: outlet.id,
                }),
                ctx({ code: 'permanent-a' }),
              )
            ).status,
            200,
          );
        const summary = await (
          await ownerOutlets.GET(req('/?businessId=a&preset=today'), ctx())
        ).json();
        assert.equal(
          summary.activity.find(
            (a: any) => a.outletId === outlet.id && a.type === 'GOOGLE_LINK_CLICK',
          )._count,
          1,
        );
        await prisma.outlet.update({ where: { id: outlet.id }, data: { active: false } });
        const hidden = await (await lookup.GET(req('/'), ctx({ code: 'permanent-a' }))).json();
        assert.equal(hidden.outlets.length, 0);
        assert.equal(hidden.defaultOutletId, null);
        assert.equal(
          (
            await events.POST(
              req('/', 'POST', {
                type: 'COPY_SUGGESTION',
                eventId: randomUUID(),
                outletId: outlet.id,
              }),
              ctx({ code: 'permanent-a' }),
            )
          ).status,
          400,
        );
        assert.equal(
          (await prisma.stand.findUniqueOrThrow({ where: { id: 'sa' } })).code,
          'permanent-a',
        );
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
