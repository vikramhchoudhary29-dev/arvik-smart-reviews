import { ownerEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { randomBytes } from 'crypto';
import { standSchema } from '@/lib/validation';
export const GET = route(
  async () =>
    NextResponse.json({
      stands: await prisma.stand.findMany({
        include: { business: { select: { name: true, slug: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    }),
  true,
);
export const POST = route(async (r) => {
  const data = standSchema.parse(await r.json());
  await prisma.business.findUniqueOrThrow({ where: { id: data.businessId } });
  const stand = await prisma.$transaction(async (tx) => {
    const s = await tx.stand.create({ data: { ...data, code: randomBytes(16).toString('hex') } });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'stand.create', targetId: s.id },
    });
    return s;
  });
  return NextResponse.json({ stand }, { status: 201 });
}, true);
