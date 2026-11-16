import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { mock } from 'node:test';
import { NextRequest } from 'next/server';
import { build } from 'esbuild';
async function main() {
  const db = await PGlite.create();
  for (const m of readdirSync('prisma/migrations')
    .filter((m) => m !== 'migration_lock.toml')
    .sort())
    await db.exec(readFileSync('prisma/migrations/' + m + '/migration.sql', 'utf8'));
  const socket = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 4 });
  await socket.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + socket.getServerConn() + '/postgres?connection_limit=1';
  process.env.RATE_LIMIT_SECRET = 'isolated-owner-browser';
  process.env.ADMIN_EMAILS = 'admin@example.test';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4319';
  process.env.FIREBASE_PROJECT_ID = 'owner-browser';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@owner-browser.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
  const { prisma } = await import('../lib/prisma');
  const { adminAuth } = await import('../lib/firebase-admin');
  mock.method(adminAuth(), 'verifyIdToken', async (token: string) => ({
    uid: token === 'admin' ? 'super' : 'browser-owner',
    email: token === 'admin' ? 'admin@example.test' : 'owner@example.test',
    email_verified: true,
  }));
  mock.method(adminAuth(), 'getUserByEmail', async (email: string) => ({
    uid: 'browser-owner',
    email,
    disabled: false,
  }));
  mock.method(adminAuth(), 'getUser', async () => ({
    uid: 'browser-owner',
    email: 'owner@example.test',
    disabled: false,
  }));
  mock.method(
    adminAuth(),
    'generatePasswordResetLink',
    async () => 'https://firebase.test/browser-private-setup',
  );
  for (const [id, name] of [
    ['a', 'Juniper Cafe'],
    ['b', 'SECRET_OTHER_BUSINESS'],
  ]) {
    await prisma.business.create({
      data: {
        id,
        name,
        slug: id,
        category: 'restaurant',
        googleReviewUrl: 'https://g.page/r/' + id + '/review',
        status: 'ACTIVE',
        linkTestedAt: new Date(),
      },
    });
    await prisma.stand.create({
      data: {
        id: 's' + id,
        businessId: id,
        code: 'permanent-' + id,
        label: 'Main counter',
        location: 'Reception',
      },
    });
    await prisma.analyticsEvent.createMany({
      data: [
        { businessId: id, standId: 's' + id, type: 'PAGE_VIEW' },
        { businessId: id, standId: 's' + id, type: 'GOOGLE_LINK_CLICK' },
      ],
    });
  }
  await prisma.businessOwner.create({
    data: { firebaseUid: 'browser-owner', email: 'owner@example.test', businessId: 'a' },
  });
  const handlers: Record<string, Record<string, Function>> = {
    '/api/owner/me': await import('../app/api/owner/me/route'),
    '/api/owner/business': await import('../app/api/owner/business/route'),
    '/api/owner/staff': await import('../app/api/owner/staff/route'),
    '/api/owner/analytics': await import('../app/api/owner/analytics/route'),
    '/api/owner/reports': await import('../app/api/owner/reports/route'),
    '/api/owner/upload': await import('../app/api/owner/upload/route'),
    '/api/owner/stands/sa/qr': await import('../app/api/owner/stands/[id]/qr/route'),
    '/api/admin/owners': await import('../app/api/admin/owners/route'),
    '/api/admin/owners/invite': await import('../app/api/admin/owners/invite/route'),
    '/api/admin/businesses': await import('../app/api/admin/businesses/route'),
    '/api/admin/settings': await import('../app/api/admin/settings/route'),
  };
  const bundle = await build({
    entryPoints: ['tests/fixtures/owner-entry.tsx'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    tsconfig: 'tsconfig.json',
    plugins: [
      {
        name: 'isolated-firebase-and-router',
        setup(build) {
          build.onResolve(
            {
              filter: /^firebase\/auth$|^@\/lib\/firebase-client$|^next\/navigation$|^next\/link$/,
            },
            (args) => ({ path: args.path, namespace: 'fixture' }),
          );
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            loader: 'js',
            resolveDir: process.cwd(),
            contents:
              args.path === 'firebase/auth'
                ? `export const onAuthStateChanged=(auth,cb)=>{let active=true;queueMicrotask(()=>active&&cb(auth.currentUser));return()=>{active=false}};export const signOut=async()=>{};`
                : args.path === '@/lib/firebase-client'
                  ? `export const clientAuth=()=>({currentUser:{getIdToken:async()=>location.pathname.startsWith('/admin')?'admin':'owner'}});`
                  : args.path === 'next/navigation'
                    ? `export const useRouter=()=>router;const router={replace:()=>{}};`
                    : `import React from 'react';export default function Link(props){return React.createElement('a',props);}`,
          }));
        },
      },
    ],
  });
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owner isolated fixture</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://localhost:4319');
      if (url.pathname === '/bundle.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(bundle.outputFiles[0].contents);
        return;
      }
      if (url.pathname === '/style.css') {
        res.setHeader('Content-Type', 'text/css');
        res.end(
          readFileSync('app/globals.css', 'utf8').replace(/@import ['"]tailwindcss['"];?/g, ''),
        );
        return;
      }
      const handler = handlers[url.pathname]?.[req.method || 'GET'];
      if (handler) {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(Buffer.from(c));
        const body = Buffer.concat(chunks);
        const r = new NextRequest(url, {
          method: req.method,
          headers: req.headers as HeadersInit,
          ...(body.length ? { body } : {}),
        });
        const response: Response = await handler(r, { params: Promise.resolve({ id: 'sa' }) });
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Fixture error' }));
    }
  });
  await new Promise<void>((resolve) => http.listen(4319, '127.0.0.1', resolve));
  console.log(
    'Isolated owner fixture on 4319; Firebase provider mocked, real API/database handlers',
  );
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
