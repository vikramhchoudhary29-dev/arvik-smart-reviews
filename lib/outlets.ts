import { prisma } from './prisma';
import { outletAction } from './outlet-model';
import { parseAnalyticsFilters, timeBounds } from './analytics-filters';
import type { NextRequest } from 'next/server';
export async function outletRequest(r: NextRequest, businessId: string, actorEmail: string) {
  if (r.method === 'GET') {
    const bounds = timeBounds(parseAnalyticsFilters(r.nextUrl.searchParams));
    const [outlets, staff, stands, activity] = await Promise.all([
      prisma.outlet.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
      prisma.staffMember.findMany({
        where: { businessId, deletedAt: null },
        select: { id: true, name: true, outletId: true },
      }),
      prisma.stand.findMany({
        where: { businessId },
        select: { id: true, label: true, code: true, outletId: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ['outletId', 'type'],
        where: { businessId, createdAt: bounds },
        _count: true,
      }),
    ]);
    return Response.json(
      { outlets, staff, stands, activity, filters: parseAnalyticsFilters(r.nextUrl.searchParams) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const input = outletAction.parse(await r.json());
  return prisma.$transaction(
    async (tx) => {
      if (input.action === 'save') {
        if (input.id && !(await tx.outlet.findFirst({ where: { id: input.id, businessId } })))
          return Response.json({ error: 'Outlet not available' }, { status: 403 });
        if (!input.id && (await tx.outlet.count({ where: { businessId } })) >= 50)
          return Response.json({ error: 'Maximum 50 outlets per business.' }, { status: 400 });
        const outlet = input.id
          ? await tx.outlet.update({ where: { id: input.id }, data: input.values })
          : await tx.outlet.create({ data: { businessId, ...input.values } });
        await tx.adminAudit.create({
          data: { actorEmail, action: 'OUTLET_SAVE', targetId: outlet.id },
        });
      } else {
        if (
          input.outletId &&
          !(await tx.outlet.findFirst({ where: { id: input.outletId, businessId, active: true } }))
        )
          return Response.json({ error: 'Outlet not available' }, { status: 403 });
        const result =
          input.action === 'staff'
            ? await tx.staffMember.updateMany({
                where: { id: input.staffId, businessId, deletedAt: null },
                data: { outletId: input.outletId },
              })
            : await tx.stand.updateMany({
                where: { id: input.standId, businessId },
                data: { outletId: input.outletId },
              });
        if (!result.count) return Response.json({ error: 'Record not available' }, { status: 403 });
        await tx.adminAudit.create({
          data: {
            actorEmail,
            action: 'OUTLET_ASSIGN_' + input.action.toUpperCase(),
            targetId: input.action === 'staff' ? input.staffId : input.standId,
          },
        });
      }
      return Response.json({ saved: true });
    },
    { isolationLevel: 'Serializable' },
  );
}
