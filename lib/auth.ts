import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';
const owners = new WeakMap<NextRequest, string>();
export function ownerEmail(request: NextRequest) {
  return owners.get(request) || '';
}
export function rememberOwner(request: NextRequest, email: string) {
  owners.set(request, email);
}

export async function requireOwner(request: NextRequest) {
  const header = request.headers.get('authorization');

  if (!header?.startsWith('Bearer ')) return false;

  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  if (!allowlist.length) return false;

  try {
    const user = await adminAuth().verifyIdToken(header.slice(7), true);

    const emailVerified = user.email_verified === true;

    const emailAllowed = Boolean(user.email && allowlist.includes(user.email.toLowerCase()));

    if (emailVerified && emailAllowed) rememberOwner(request, user.email!.toLowerCase());
    return emailVerified && emailAllowed;
  } catch (error) {
    console.error(
      '[Firebase Admin Auth] Token verification failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return false;
  }
}
