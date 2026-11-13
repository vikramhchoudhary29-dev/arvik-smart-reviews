import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { templateSchema } from '@/lib/validation';
export const GET = route(
  async () =>
    NextResponse.json({
      templates: await prisma.reviewPhrase.findMany({ orderBy: { createdAt: 'desc' } }),
    }),
  true,
);
export const POST = route(async (r) => {
  const data = templateSchema.parse(await r.json());
  const template = await prisma.$transaction(async (tx) => {
    const v = await tx.reviewPhrase.create({ data });
    await tx.adminAudit.create({
      data: { action: 'template.create', targetId: v.id, actorEmail: ownerEmail(r) },
    });
    return v;
  });
  return NextResponse.json({ template }, { status: 201 });
}, true);
