import { ownerEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { businessSchema } from '@/lib/validation';
export const GET = route(
  async () =>
    NextResponse.json({
      businesses: await prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { stands: true, customers: true } } },
      }),
    }),
  true,
);
export const POST = route(async (r) => {
  const { linkTested, ...data } = businessSchema.parse(await r.json());
  if (data.status === 'ACTIVE' && !linkTested)
    return NextResponse.json(
      {
        error:
          'Test the Google destination and confirm it belongs to this business before activation',
      },
      { status: 400 },
    );
  const business = await prisma.$transaction(async (tx) => {
    const b = await tx.business.create({
      data: { ...data, linkTestedAt: linkTested ? new Date() : null },
    });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'business.create', targetId: b.id },
    });
    return b;
  });
  return NextResponse.json({ business }, { status: 201 });
}, true);
