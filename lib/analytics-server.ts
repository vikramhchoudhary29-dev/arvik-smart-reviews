import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from './prisma';
import { parseAnalyticsFilters, timeBounds, aggregateSeries } from './analytics-filters';
import {
  emptyCounts,
  countKey,
  percent,
  type EventName,
  type Counts,
  type Performance,
  type AnalyticsSnapshot,
  type SeriesPoint,
} from './analytics-model';
export async function analyticsSnapshot(
  q: URLSearchParams,
  now = new Date(),
  scopeBusinessId?: string,
) {
  const filters = parseAnalyticsFilters(q, now);
  if (scopeBusinessId) {
    filters.businessId = scopeBusinessId;
    if (
      filters.standId &&
      !(await prisma.stand.findFirst({
        where: { id: filters.standId, businessId: scopeBusinessId },
        select: { id: true },
      }))
    )
      throw new ZodError([
        { code: 'custom', message: 'Stand not available for this business.', path: ['standId'] },
      ]);
  }
  const bounds = timeBounds(filters);
  const where = {
    createdAt: bounds,
    ...(filters.businessId ? { businessId: filters.businessId } : {}),
    ...(filters.standId ? { standId: filters.standId } : {}),
  };
  return prisma.$transaction(
    async (tx) => {
      const [
        totals,
        businessPerformance,
        standPerformance,
        daily,
        businesses,
        stands,
        recent,
        businessOptions,
        standOptions,
      ] = await Promise.all([
        tx.analyticsEvent.groupBy({ by: ['type'], where, _count: true }),
        tx.analyticsEvent.groupBy({ by: ['businessId', 'type'], where, _count: true }),
        tx.analyticsEvent.groupBy({ by: ['standId', 'type'], where, _count: true }),
        tx.$queryRaw<Array<{ day: string; type: EventName; count: bigint }>>(
          Prisma.sql`SELECT to_char("createdAt",'YYYY-MM-DD') AS day,type::text,count(*) FROM "AnalyticsEvent" WHERE "createdAt">=${bounds.gte} AND "createdAt"<${bounds.lt} ${filters.businessId ? Prisma.sql`AND "businessId"=${filters.businessId}` : Prisma.empty} ${filters.standId ? Prisma.sql`AND "standId"=${filters.standId}` : Prisma.empty} GROUP BY day,type ORDER BY day`,
        ),
        tx.business.groupBy({
          by: ['status'],
          where: scopeBusinessId ? { id: scopeBusinessId } : {},
          _count: true,
        }),
        tx.stand.groupBy({
          by: ['active'],
          where: scopeBusinessId ? { businessId: scopeBusinessId } : {},
          _count: true,
        }),
        tx.analyticsEvent.findMany({
          where,
          take: 20,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            business: { select: { name: true } },
            stand: { select: { label: true, code: true } },
          },
        }),
        tx.business.findMany({
          where: scopeBusinessId ? { id: scopeBusinessId } : {},
          select: { id: true, name: true, status: true },
          orderBy: { name: 'asc' },
        }),
        tx.stand.findMany({
          where: scopeBusinessId ? { businessId: scopeBusinessId } : {},
          select: {
            id: true,
            label: true,
            code: true,
            active: true,
            businessId: true,
            business: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      const activity = emptyCounts();
      for (const row of totals) activity[countKey[row.type]] += row._count;
      const dailyMap = new Map<string, SeriesPoint>();
      for (const row of daily) {
        if (!dailyMap.has(row.day)) dailyMap.set(row.day, { period: row.day, ...emptyCounts() });
        dailyMap.get(row.day)![countKey[row.type]] += Number(row.count);
      }
      function performance(
        id: string,
        name: string,
        status: string,
        counts: { type: EventName; _count: number }[],
        extra: Partial<Performance> = {},
      ): Performance {
        const values = emptyCounts();
        for (const row of counts) values[countKey[row.type]] += row._count;
        return {
          id,
          name,
          status,
          ...extra,
          ...values,
          ctr: percent(values.clicks, values.visits),
          share: percent(values.clicks, activity.clicks),
        };
      }
      const businessCounts = new Map<string, typeof businessPerformance>();
      for (const row of businessPerformance) {
        const values = businessCounts.get(row.businessId) || [];
        values.push(row);
        businessCounts.set(row.businessId, values);
      }
      const standCounts = new Map<string | null, typeof standPerformance>();
      for (const row of standPerformance) {
        const values = standCounts.get(row.standId) || [];
        values.push(row);
        standCounts.set(row.standId, values);
      }
      const businessRows = businessOptions
        .filter(
          (b) =>
            (!filters.businessId || b.id === filters.businessId) &&
            (!filters.standId || businessCounts.has(b.id)),
        )
        .map((b) => performance(b.id, b.name, b.status, businessCounts.get(b.id) || []));
      const standRows = standOptions
        .filter(
          (s) =>
            (!filters.standId || s.id === filters.standId) &&
            (!filters.businessId || s.businessId === filters.businessId || standCounts.has(s.id)),
        )
        .map((s) =>
          performance(
            s.id,
            s.label || s.code,
            s.active ? 'ACTIVE' : 'INACTIVE',
            standCounts.get(s.id) || [],
            { code: s.code, businessName: s.business.name },
          ),
        );
      const unassigned = standCounts.get(null) || [];
      if (unassigned.length)
        standRows.push(
          performance('unassigned', 'Unassigned historical events', 'N/A', unassigned, {
            businessName: 'Not recorded',
            code: '—',
          }),
        );
      const snapshot: AnalyticsSnapshot = {
        generatedAt: now.toISOString(),
        inventoryScope: scopeBusinessId ? 'business' : 'platform',
        filters,
        inventory: {
          totalBusinesses: businesses.reduce((n, b) => n + b._count, 0),
          activeBusinesses: businesses.find((b) => b.status === 'ACTIVE')?._count || 0,
          inactiveBusinesses: businesses.find((b) => b.status === 'INACTIVE')?._count || 0,
          totalStands: stands.reduce((n, s) => n + s._count, 0),
          activeStands: stands.find((s) => s.active)?._count || 0,
          inactiveStands: stands.find((s) => !s.active)?._count || 0,
        },
        activity: { ...activity, ctr: percent(activity.clicks, activity.visits) },
        series: aggregateSeries([...dailyMap.values()], filters),
        businessRows,
        standRows,
        options: {
          businesses: businessOptions.map((b) => ({ id: b.id, name: b.name })),
          stands: standOptions.map((s) => ({
            id: s.id,
            name: s.label || s.code,
            code: s.code,
            businessId: s.businessId,
          })),
        },
        recent: recent.map((r) => ({
          id: r.id,
          type: r.type,
          createdAt: r.createdAt.toISOString(),
          businessName: r.business.name,
          standName: scopeBusinessId
            ? standOptions.find((s) => s.id === r.standId)?.label ||
              standOptions.find((s) => s.id === r.standId)?.code ||
              'Unassigned historical stand'
            : r.stand?.label || r.stand?.code || 'Unassigned stand',
        })),
        templateUsage: {
          supported: false,
          reason:
            'Template IDs were not recorded in historical analytics. Template usage cannot be reconstructed from generation counts.',
        },
        notes: [
          scopeBusinessId
            ? 'All activity and inventory are restricted to your selected business. Activity uses selected UTC calendar dates; inventory counts are current all-time records.'
            : 'All activity uses the selected UTC calendar dates and recorded business/stand IDs at event time. Inventory counts are platform-wide current records and ignore activity filters.',
          'Google clicks / visits is an event ratio, not a unique-visitor conversion rate. It can exceed 100% when people click repeatedly. Zero visits gives N/A.',
          'Funnel stages are independent event counts; regenerations are separate from initial generation. There is no session/cohort or published-review tracking.',
          'New event IDs are deduplicated by the existing unique key. Legacy rows without keys remain counted as recorded; duplicates cannot be inferred safely.',
          'Stand business names show current assignment; historical events retain their original business. Zero-activity records remain visible.',
          'Table search and sorting affect report rows only. Summary totals and charts retain the applied date/entity scope.',
        ],
      };
      return {
        ...snapshot,
        totals,
        businessPerformance,
        standPerformance,
        daily: daily.map((d) => ({ ...d, count: Number(d.count) })),
        businesses,
        stands,
        from: bounds.gte.toISOString(),
        to: new Date(bounds.lt.getTime() - 1).toISOString(),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 },
  );
}
