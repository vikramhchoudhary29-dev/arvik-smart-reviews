import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';
import { prisma } from './prisma';
import { route, limited } from './http';

export type BusinessIdentity = { uid: string; email: string };
export async function businessIdentity(r: NextRequest): Promise<BusinessIdentity | null> {
  const header = r.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const user = await adminAuth().verifyIdToken(header.slice(7), true);
    return user.uid && user.email && user.email_verified === true
      ? { uid: user.uid, email: user.email.toLowerCase() }
      : null;
  } catch {
    return null;
  }
}
type Context = { params: Promise<Record<string, string>> };
// Authentication and database assignment are checked on EVERY request, including exports and QR.
export function businessRoute(
  fn: (r: NextRequest, identity: BusinessIdentity, c: Context) => Promise<Response>,
) {
  return route(async (r, c) => {
    const identity = await businessIdentity(r);
    if (!identity)
      return NextResponse.json(
        { error: 'Please sign in with a verified business account.' },
        { status: 401 },
      );
    if (await limited(r, 'business-owner', 180))
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    return fn(r, identity, c);
  });
}
export async function assignedBusiness(uid: string, businessId: string) {
  if (!businessId) return null;
  return prisma.businessOwner.findFirst({
    where: { firebaseUid: uid, businessId, active: true },
    select: {
      business: {
        select: {
          id: true,
          name: true,
          category: true,
          logo: true,
          coverImage: true,
          brandColor: true,
          welcomeMessage: true,
          status: true,
        },
      },
    },
  });
}
export const denied = () =>
  NextResponse.json({ error: 'Business access not available.' }, { status: 403 });
export const privateJson = (data: unknown) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
