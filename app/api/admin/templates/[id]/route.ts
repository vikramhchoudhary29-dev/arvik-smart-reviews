import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { templateSchema, partialInput } from '@/lib/validation';
export const PATCH = route(async (r, c) => {
  const { id } = await c.params;
  const data = partialInput(templateSchema, await r.json());
  const template = await prisma.$transaction(async (tx) => {
    const v = await tx.reviewPhrase.update({ where: { id }, data });
    await tx.adminAudit.create({
      data: { action: 'template.update', targetId: id, actorEmail: ownerEmail(r) },
    });
    return v;
  });
  return NextResponse.json({ template });
}, true);
export const DELETE = route(async (r, c) => {
  const { id } = await c.params;
  await prisma.$transaction([
    prisma.reviewPhrase.delete({ where: { id } }),
    prisma.adminAudit.create({
      data: { action: 'template.delete', targetId: id, actorEmail: ownerEmail(r) },
    }),
  ]);
  return NextResponse.json({ ok: true });
}, true);
