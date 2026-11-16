import { assignedBusiness, businessRoute, denied, privateJson } from '@/lib/business-access';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { experienceSchema, staffQuestion } from '@/lib/experience';
import { timeBounds, parseAnalyticsFilters } from '@/lib/analytics-filters';
export const GET = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  const assignment = await assignedBusiness(identity.uid, businessId);
  if (!assignment) return denied();
  const bounds = timeBounds(parseAnalyticsFilters(r.nextUrl.searchParams));
  const [settings, staff, mentions, stands] = await Promise.all([
    prisma.businessExperience.findUnique({ where: { businessId } }),
    prisma.staffMember.findMany({
      where: { businessId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.staffMention.groupBy({
      by: ['staffId'],
      where: { businessId, createdAt: bounds },
      _count: true,
    }),
    prisma.stand.findMany({
      where: { businessId },
      select: {
        id: true,
        label: true,
        code: true,
        location: true,
        active: true,
        lastActivity: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return privateJson({
    business: assignment.business,
    settings: settings || { staffEnabled: false, staffQuestion: '' },
    defaultQuestion: staffQuestion(assignment.business.category),
    staff: staff.map((s) => ({
      ...s,
      mentions: mentions.find((m) => m.staffId === s.id)?._count || 0,
    })),
    stands,
    mentionRange: parseAnalyticsFilters(r.nextUrl.searchParams),
  });
});
const branding = z
  .object({
    logo: z.string().regex(/^$|^\/api\/media\/[a-z0-9]+$/),
    brandColor: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    welcomeMessage: z.string().trim().max(300),
  })
  .strict();
export const PATCH = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  const input = z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('branding'), values: branding }).strict(),
      z.object({ kind: z.literal('experience'), values: experienceSchema }).strict(),
    ])
    .parse(await r.json());
  await prisma.$transaction(async (tx) => {
    if (input.kind === 'branding')
      await tx.business.update({ where: { id: businessId }, data: input.values });
    else
      await tx.businessExperience.upsert({
        where: { businessId },
        create: { businessId, ...input.values },
        update: input.values,
      });
    await tx.adminAudit.create({
      data: {
        actorEmail: identity.email,
        action: 'OWNER_' + input.kind.toUpperCase(),
        targetId: businessId,
      },
    });
  });
  return privateJson({ saved: true });
});
