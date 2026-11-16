import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';
const json = (data: unknown) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
export const GET = route(
  async () =>
    json({
      owners: await prisma.businessOwner.findMany({
        select: {
          id: true,
          email: true,
          businessId: true,
          active: true,
          business: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    }),
  true,
);
export const POST = route(async (r) => {
  const input = z
    .object({ email: z.email().transform((v) => v.toLowerCase()), businessId: z.string().min(1) })
    .strict()
    .parse(await r.json());
  // Probe the new table before creating any Firebase account if migration is pending.
  await prisma.businessOwner.count({ where: { businessId: input.businessId } });
  if (
    !(await prisma.business.findUnique({ where: { id: input.businessId }, select: { id: true } }))
  )
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
  let user;
  try {
    user = await adminAuth().getUserByEmail(input.email);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    user = await adminAuth().createUser({ email: input.email, emailVerified: false });
  }
  if (user.disabled)
    return NextResponse.json({ error: 'This Firebase account is disabled.' }, { status: 409 });
  const owner = await prisma.$transaction(async (tx) => {
    const result = await tx.businessOwner.upsert({
      where: { firebaseUid_businessId: { firebaseUid: user.uid, businessId: input.businessId } },
      create: { firebaseUid: user.uid, businessId: input.businessId, email: input.email },
      update: { active: true, email: input.email },
    });
    await tx.adminAudit.create({
      data: { actorEmail: ownerEmail(r), action: 'OWNER_ACCESS_GRANTED', targetId: result.id },
    });
    return result;
  });
  return json({ owner: { id: owner.id, email: owner.email, active: owner.active } });
}, true);
export const PATCH = route(async (r) => {
  const input = z
    .object({ id: z.string().min(1), active: z.boolean() })
    .strict()
    .parse(await r.json());
  await prisma.$transaction(async (tx) => {
    await tx.businessOwner.update({ where: { id: input.id }, data: { active: input.active } });
    await tx.adminAudit.create({
      data: {
        actorEmail: ownerEmail(r),
        action: input.active ? 'OWNER_ACCESS_GRANTED' : 'OWNER_ACCESS_REVOKED',
        targetId: input.id,
      },
    });
  });
  return json({ saved: true });
}, true);
