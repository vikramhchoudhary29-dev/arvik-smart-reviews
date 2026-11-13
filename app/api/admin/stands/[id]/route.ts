import { ownerEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { standSchema, partialInput } from '@/lib/validation';
export const PATCH = route(async (r, c) => {
  const { id } = await c.params;
  const data = partialInput(standSchema, await r.json());
  if (data.businessId) await prisma.business.findUniqueOrThrow({ where: { id: data.businessId } });
  const stand = await prisma.$transaction(async (tx) => {
    const s = await tx.stand.update({ where: { id }, data });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'stand.update', targetId: id },
    });
    return s;
  });
  return NextResponse.json({ stand });
}, true);
