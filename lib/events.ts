import { EventType } from '@prisma/client';
import { prisma } from './prisma';
export async function recordEvent(
  stand: { id: string; businessId: string },
  type: EventType,
  eventId: string,
) {
  const dedupKey = stand.id + ':' + type + ':' + eventId;
  await prisma.$transaction(async (tx) => {
    await tx.analyticsEvent.upsert({
      where: { dedupKey },
      create: { dedupKey, standId: stand.id, businessId: stand.businessId, type },
      update: {},
    });
    await tx.stand.update({ where: { id: stand.id }, data: { lastActivity: new Date() } });
  });
}
