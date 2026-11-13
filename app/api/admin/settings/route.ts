import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { z } from 'zod';
export const GET = route(
  async () =>
    NextResponse.json({
      settings: (await prisma.applicationSettings.findUnique({ where: { id: 'default' } })) ?? {
        supportEmail: '',
        retentionDays: 90,
      },
      publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    }),
  true,
);
export const PATCH = route(async (r) => {
  const data = z
    .object({
      supportEmail: z.union([z.literal(''), z.email()]),
      retentionDays: z.number().int().min(7).max(365),
    })
    .strict()
    .parse(await r.json());
  const settings = await prisma.$transaction(async (tx) => {
    const s = await tx.applicationSettings.upsert({
      where: { id: 'default' },
      create: data,
      update: data,
    });
    await tx.adminAudit.create({
      data: { action: 'settings.update', targetId: 'default', actorEmail: ownerEmail(r) },
    });
    return s;
  });
  return NextResponse.json({ settings });
}, true);
