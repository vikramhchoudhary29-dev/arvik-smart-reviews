import { prisma } from './prisma';
import { isoDay, periodStatus, type Period } from './subscription-model';
import type { SubscriptionPeriod, SubscriptionPayment } from '@prisma/client';
type SubscriptionRecord = SubscriptionPeriod & { payments: SubscriptionPayment[] };
export async function subscriptionDetails(businessId: string, now = new Date(), admin = false) {
  const records = await prisma.subscriptionPeriod.findMany({
    where: { businessId },
    include: { payments: { orderBy: [{ paidOn: 'desc' }, { id: 'desc' }] } },
    orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
  });
  return summarizeSubscriptions(records, now, admin);
}
export function summarizeSubscriptions(
  records: SubscriptionRecord[],
  now = new Date(),
  admin = false,
) {
  const periods: Period[] = records.map((record) => {
    const paidPaise = record.payments
      .filter((p) => !p.voidedAt)
      .reduce((sum, p) => sum + p.amountPaise, 0);
    const startsOn = isoDay(record.startsOn),
      expiresOn = isoDay(record.expiresOn);
    return {
      id: record.id,
      startsOn,
      expiresOn,
      annualFeePaise: record.annualFeePaise,
      currency: record.currency,
      paidPaise,
      duePaise: Math.max(0, record.annualFeePaise - paidPaise),
      paymentStatus: paidPaise >= record.annualFeePaise ? 'PAID' : paidPaise ? 'PARTIAL' : 'UNPAID',
      ...periodStatus(startsOn, expiresOn, now),
      payments: record.payments.map((p) => ({
        id: p.id,
        amountPaise: p.amountPaise,
        paidOn: isoDay(p.paidOn),
        method: p.method,
        reference: admin ? p.reference : '',
        voided: Boolean(p.voidedAt),
      })),
      ...(admin ? { notes: record.notes } : {}),
    };
  });
  const current =
    periods.find((p) => p.status === 'ACTIVE' || p.status === 'EXPIRING_SOON') ||
    periods.find((p) => p.status === 'EXPIRED') ||
    periods[periods.length - 1] ||
    null;
  const next =
    periods
      .filter((p) => p.status === 'UPCOMING')
      .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] || null;
  return { periods, current, next, reviewPagePolicy: 'WARNING_ONLY' as const };
}
