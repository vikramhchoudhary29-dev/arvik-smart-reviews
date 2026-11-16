import { assignedBusiness, businessRoute, denied, privateJson } from '@/lib/business-access';
import { prisma } from '@/lib/prisma';
import { staffSchema } from '@/lib/experience';
import { z } from 'zod';
export const POST = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  const input = z
    .object({ id: z.string().max(100).optional(), values: staffSchema })
    .strict()
    .parse(await r.json());
  if (input.id && !(await prisma.staffMember.findFirst({ where: { id: input.id, businessId } })))
    return denied();
  // Bound public staff lists and accidental overgrowth; deactivation preserves historical mentions.
  if (!input.id && (await prisma.staffMember.count({ where: { businessId } })) >= 100)
    return Response.json(
      {
        error:
          'A maximum of 100 staff records is supported. Edit or reactivate an existing record.',
      },
      { status: 400 },
    );
  const staff = await prisma.$transaction(async (tx) => {
    const result = input.id
      ? await tx.staffMember.update({ where: { id: input.id }, data: input.values })
      : await tx.staffMember.create({ data: { businessId, ...input.values } });
    await tx.adminAudit.create({
      data: { actorEmail: identity.email, action: 'OWNER_STAFF_SAVE', targetId: result.id },
    });
    return result;
  });
  return privateJson({ staff });
});
