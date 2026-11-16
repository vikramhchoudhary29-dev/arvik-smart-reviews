import { route, limited } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase-admin';
import { ownerEmail } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
export const POST = route(async (r) => {
  if (await limited(r, 'owner-invite', 10))
    return NextResponse.json(
      { error: 'Please wait before generating another link.' },
      { status: 429 },
    );
  const { id } = z
    .object({ id: z.string().min(1) })
    .strict()
    .parse(await r.json());
  const owner = await prisma.businessOwner.findFirst({ where: { id, active: true } });
  if (!owner)
    return NextResponse.json({ error: 'Active owner assignment not found.' }, { status: 404 });
  const user = await adminAuth().getUser(owner.firebaseUid);
  if (user.disabled || !user.email || user.email.toLowerCase() !== owner.email)
    return NextResponse.json(
      {
        error:
          'Account email changed or account disabled. Reassign access using the current email.',
      },
      { status: 409 },
    );
  const url = new URL(
    '/owner/login',
    process.env.NEXT_PUBLIC_APP_URL || r.nextUrl.origin,
  ).toString();
  const setupLink = await adminAuth().generatePasswordResetLink(owner.email, { url });
  await prisma.adminAudit.create({
    data: { actorEmail: ownerEmail(r), action: 'OWNER_SETUP_LINK_CREATED', targetId: id },
  });
  // Sensitive, short-lived Firebase link shown only on demand; not logged or persisted.
  return NextResponse.json({ setupLink }, { headers: { 'Cache-Control': 'private, no-store' } });
}, true);
