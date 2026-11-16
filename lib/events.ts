import { EventType } from '@prisma/client';
import { prisma } from './prisma';
export async function recordEvent(
  stand: { id: string; businessId: string },
  type: EventType,
  eventId: string,
  staffId?: string,
) {
  const dedupKey = stand.id + ':' + type + ':' + eventId;
  await prisma.$transaction(async (tx) => {
    const event = await tx.analyticsEvent.upsert({
      where: { dedupKey },
      create: { dedupKey, standId: stand.id, businessId: stand.businessId, type },
      update: {},
    });
    if (staffId)
      await tx.staffMention.upsert({
        where: { dedupKey: event.id },
        create: { dedupKey: event.id, businessId: stand.businessId, standId: stand.id, staffId },
        update: {},
      });
    await tx.stand.update({ where: { id: stand.id }, data: { lastActivity: new Date() } });
  });
}
