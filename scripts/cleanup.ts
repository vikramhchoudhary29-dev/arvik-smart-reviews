import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const s = await db.applicationSettings.findUnique({ where: { id: 'default' } });
  const result = await db.analyticsEvent.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - (s?.retentionDays ?? 90) * 86400000) } },
  });
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log('Expired analytics deleted:', result.count);
}
main().finally(() => db.$disconnect());
