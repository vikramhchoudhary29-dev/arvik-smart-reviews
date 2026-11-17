import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { dateOnly, paise, utcDate, isoDay } from '@/lib/subscription-model';
export const POST = route(async (r) => {
  const input = z
    .object({
      subscriptionId: z.string().min(1),
      amountPaise: paise.refine((v) => v > 0, 'Payment must be greater than zero'),
      paidOn: dateOnly,
      method: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER']),
      reference: z.string().trim().max(150).default(''),
    })
    .strict()
    .parse(await r.json());
  if (input.paidOn > isoDay(new Date()))
    return Response.json({ error: 'Payment date cannot be in the future.' }, { status: 400 });
  await prisma.$transaction(
    async (tx) => {
      const period = await tx.subscriptionPeriod.findUniqueOrThrow({
        where: { id: input.subscriptionId },
        include: { payments: { where: { voidedAt: null } } },
      });
      const paid = period.payments.reduce((sum, p) => sum + p.amountPaise, 0);
      if (paid + input.amountPaise > period.annualFeePaise)
        throw new z.ZodError([
          {
            code: 'custom',
            message: 'Payment exceeds the unpaid balance for this yearly term.',
            path: ['amountPaise'],
          },
        ]);
      const payment = await tx.subscriptionPayment.create({
        data: { ...input, paidOn: utcDate(input.paidOn) },
      });
      await tx.adminAudit.create({
        data: {
          actorEmail: ownerEmail(r),
          action: 'SUBSCRIPTION_PAYMENT_RECORD',
          targetId: payment.id,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return Response.json({ saved: true });
}, true);
export const DELETE = route(async (r) => {
  const { id } = z
    .object({ id: z.string().min(1) })
    .strict()
    .parse(await r.json());
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({ where: { id }, data: { voidedAt: new Date() } });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'SUBSCRIPTION_PAYMENT_VOID', targetId: id },
    });
  });
  return Response.json({ voided: true });
}, true);
