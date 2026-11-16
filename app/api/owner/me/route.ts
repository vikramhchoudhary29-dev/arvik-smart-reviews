import { businessRoute, privateJson } from '@/lib/business-access';
import { prisma } from '@/lib/prisma';
export const GET = businessRoute(async (_r, identity) => {
  const assignments = await prisma.businessOwner.findMany({
    where: { firebaseUid: identity.uid, active: true },
    select: { business: { select: { id: true, name: true, category: true, status: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return privateJson({ email: identity.email, businesses: assignments.map((a) => a.business) });
});
