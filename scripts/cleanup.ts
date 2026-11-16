import { Prisma, PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const s = await db.applicationSettings.findUnique({ where: { id: 'default' } });
  const cutoff = new Date(Date.now() - (s?.retentionDays ?? 90) * 86400000);
  try {
    await db.staffMention.deleteMany({ where: { createdAt: { lt: cutoff } } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2021') throw e;
  }
  const result = await db.analyticsEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log('Expired analytics deleted:', result.count);
}
main().finally(() => db.$disconnect());
