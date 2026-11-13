import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from './prisma';
import { requireOwner, ownerEmail, rememberOwner } from './auth';
import { createHmac } from 'crypto';
type Context = { params: Promise<Record<string, string>> };
export function route(fn: (r: NextRequest, c: Context) => Promise<Response>, admin = false) {
  return async (r: NextRequest, c: Context) => {
    try {
      if (admin && !(await requireOwner(r)))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (
        r.method !== 'GET' &&
        r.headers.get('origin') &&
        r.headers.get('origin') !== r.nextUrl.origin
      )
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
      if (admin && (await limited(r, 'admin', 240)))
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      const actorEmail = ownerEmail(r);
      if (r.body && r.method !== 'GET') {
        const reader = r.body.getReader();
        const chunks: Buffer[] = [];
        let size = 0;
        const limit = r.headers.get('content-type')?.includes('multipart/form-data')
          ? 1100000
          : 32000;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > limit) {
            void reader.cancel();
            return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
          }
          chunks.push(Buffer.from(part.value));
        }
        r = new NextRequest(r.url, {
          method: r.method,
          headers: r.headers,
          body: Buffer.concat(chunks),
        });
        if (actorEmail) rememberOwner(r, actorEmail);
      }
      return await fn(r, c);
    } catch (e) {
      if (e instanceof ZodError)
        return NextResponse.json(
          { error: e.issues.map((i) => i.message).join('; ') },
          { status: 400 },
        );
      if (e instanceof SyntaxError)
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002')
          return NextResponse.json({ error: 'Already exists' }, { status: 409 });
        if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      console.error('Request failed', e instanceof Error ? e.name : 'Unknown');
      return NextResponse.json({ error: 'Request failed. Please try again.' }, { status: 500 });
    }
  };
}
export async function limited(r: NextRequest, scope: string, max = 60) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) throw Error('RATE_LIMIT_SECRET required');
  const ip = r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const bucket = Math.floor(Date.now() / 60000);
  const key = createHmac('sha256', secret)
    .update(scope + ':' + ip + ':' + bucket)
    .digest('hex');
  const entry = await prisma.rateLimit.upsert({
    where: { key },
    create: { key, expiresAt: new Date((bucket + 2) * 60000) },
    update: { count: { increment: 1 } },
  });
  return entry.count > max;
}
export async function activeStand(code: string) {
  const s = await prisma.stand.findUnique({ where: { code }, include: { business: true } });
  return s?.active && s.business.status === 'ACTIVE' && s.business.linkTestedAt ? s : null;
}
export const unavailable = () =>
  NextResponse.json({ error: 'Stand unavailable. Please contact the business.' }, { status: 404 });
