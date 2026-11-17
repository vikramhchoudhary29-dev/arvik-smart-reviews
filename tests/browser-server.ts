import { seed } from '../lib/seed';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
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
  const server = new PGLiteSocketServer({ db, port: 0, maxConnections: 8 });
  await server.start();
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@' + server.getServerConn() + '/postgres?connection_limit=1';
  process.env.RATE_LIMIT_SECRET = 'browser-isolated-secret';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4317';
  const prisma = new PrismaClient();
  await prisma.business.create({
    data: {
      id: 'browser-business',
      name: 'Shree Optical',
      slug: 'shree-optical',
      category: 'optical',
      googleReviewUrl: 'https://g.page/r/browser-test/review',
      status: 'ACTIVE',
      linkTestedAt: new Date(),
      welcomeMessage: 'Thank you for visiting Shree Optical!',
      description: 'Tell us about your visit.',
    },
  });
  await prisma.stand.create({
    data: { businessId: 'browser-business', code: 'browser-test', label: 'Counter' },
  });
  await prisma.businessExperience.create({
    data: { businessId: 'browser-business', staffEnabled: true, staffQuestion: '' },
  });
  await prisma.staffMember.create({
    data: { businessId: 'browser-business', name: 'Priya', role: 'Advisor' },
  });
  await seed(prisma);
  await prisma.$disconnect();
  await db.exec('DEALLOCATE ALL');
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', '4317'],
    { env: process.env, stdio: 'inherit' },
  );
  const stop = async () => {
    child.kill();
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  child.on('exit', stop);
}
main();
