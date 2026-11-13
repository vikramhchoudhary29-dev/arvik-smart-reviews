import { ownerEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { businessSchema, partialInput } from '@/lib/validation';
export const GET = route(async (r, c) => {
  const { id } = await c.params;
  return NextResponse.json({
    business: await prisma.business.findUniqueOrThrow({ where: { id }, include: { stands: true } }),
  });
}, true);
export const PATCH = route(async (r, c) => {
  const { id } = await c.params;
  const old = await prisma.business.findUniqueOrThrow({ where: { id } });
  const input = partialInput(businessSchema, await r.json());
  const { linkTested, ...data } = input;
  const changed =
    data.googleReviewUrl !== undefined && data.googleReviewUrl !== old.googleReviewUrl;
  const tested = linkTested ? new Date() : changed ? null : old.linkTestedAt;
  if ((data.status ?? old.status) === 'ACTIVE' && !tested)
    return NextResponse.json(
      { error: 'Test and confirm the Google destination before activation' },
      { status: 400 },
    );
  const business = await prisma.$transaction(async (tx) => {
    const b = await tx.business.update({ where: { id }, data: { ...data, linkTestedAt: tested } });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'business.update', targetId: id },
    });
    return b;
  });
  return NextResponse.json({ business });
}, true);
export const DELETE = route(async (r, c) => {
  const { id } = await c.params;
  const business = await prisma.business.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { stands: true, customers: true, events: true, transactions: true } },
    },
  });
  if (Object.values(business._count).some((n) => n > 0))
    return NextResponse.json(
      { error: 'Business has history or assigned stands. Deactivate it to preserve records.' },
      { status: 409 },
    );
  await prisma.$transaction([
    prisma.loyaltyProgram.deleteMany({ where: { businessId: id } }),
    prisma.business.delete({ where: { id } }),
    prisma.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'business.delete', targetId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}, true);
