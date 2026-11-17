import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { annualExpiry, dateOnly, paise, utcDate, isoDay, nextDay } from '@/lib/subscription-model';
import { summarizeSubscriptions } from '@/lib/subscriptions';
const json = (data: unknown) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
export const GET = route(async (r) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  const [businesses, periods] = await Promise.all([
    prisma.business.findMany({
      where: businessId ? { id: businessId } : {},
      select: { id: true, name: true, status: true, renewalWhatsapp: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subscriptionPeriod.findMany({
      where: businessId ? { businessId } : {},
      include: { payments: { orderBy: [{ paidOn: 'desc' }, { id: 'desc' }] } },
      orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
    }),
  ]);
  return json({
    businesses: businesses.map((b) => ({
      ...b,
      ...summarizeSubscriptions(
        periods.filter((p) => p.businessId === b.id),
        new Date(),
        true,
      ),
    })),
    policy:
      'Expiry warnings only. Review pages remain active unless separately deactivated by Super Admin.',
  });
}, true);

export const PATCH = route(async (r) => {
  const input = z
    .object({ id: z.string().min(1), annualFeePaise: paise, notes: z.string().trim().max(1000) })
    .strict()
    .parse(await r.json());
  await prisma.$transaction(
    async (tx) => {
      const period = await tx.subscriptionPeriod.findUniqueOrThrow({
        where: { id: input.id },
        include: { payments: { where: { voidedAt: null } } },
      });
      const paid = period.payments.reduce((sum, p) => sum + p.amountPaise, 0);
      if (input.annualFeePaise < paid)
        throw new z.ZodError([
          {
            code: 'custom',
            message:
              'Annual fee cannot be lower than recorded payments. Void an incorrect payment first.',
            path: ['annualFeePaise'],
          },
        ]);
      await tx.subscriptionPeriod.update({
        where: { id: input.id },
        data: { annualFeePaise: input.annualFeePaise, notes: input.notes },
      });
      await tx.adminAudit.create({
        data: { actorEmail: ownerEmail(r), action: 'SUBSCRIPTION_UPDATE', targetId: input.id },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return json({ saved: true });
}, true);
const create = z
  .object({
    action: z.literal('create'),
    businessId: z.string().min(1),
    startsOn: dateOnly,
    annualFeePaise: paise,
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();
const renew = z
  .object({
    action: z.literal('renew'),
    businessId: z.string().min(1),
    annualFeePaise: paise,
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();
export const POST = route(async (r) => {
  const input = z.discriminatedUnion('action', [create, renew]).parse(await r.json());
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.business.findUniqueOrThrow({
        where: { id: input.businessId },
        select: { id: true },
      });
      const last = await tx.subscriptionPeriod.findFirst({
        where: { businessId: input.businessId },
        orderBy: { expiresOn: 'desc' },
      });
      const today = isoDay(new Date());
      const startsOn =
        input.action === 'create'
          ? input.startsOn
          : last
            ? nextDay(isoDay(last.expiresOn)) > today
              ? nextDay(isoDay(last.expiresOn))
              : today
            : today;
      const expiresOn = annualExpiry(startsOn);
      if (
        await tx.subscriptionPeriod.findFirst({
          where: {
            businessId: input.businessId,
            startsOn: { lte: utcDate(expiresOn) },
            expiresOn: { gte: utcDate(startsOn) },
          },
        })
      )
        throw new z.ZodError([
          {
            code: 'custom',
            message:
              'This term overlaps an existing subscription. Use Renew for the next yearly term.',
            path: ['startsOn'],
          },
        ]);
      const period = await tx.subscriptionPeriod.create({
        data: {
          businessId: input.businessId,
          startsOn: utcDate(startsOn),
          expiresOn: utcDate(expiresOn),
          annualFeePaise: input.annualFeePaise,
          notes: input.notes,
        },
      });
      await tx.adminAudit.create({
        data: {
          actorEmail: ownerEmail(r),
          action: input.action === 'renew' ? 'SUBSCRIPTION_RENEW' : 'SUBSCRIPTION_CREATE',
          targetId: period.id,
        },
      });
      return period;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return json({
    subscription: {
      id: result.id,
      startsOn: isoDay(result.startsOn),
      expiresOn: isoDay(result.expiresOn),
    },
  });
}, true);
