import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
export const GET = route(async (r, c) => {
  const { id } = await c.params;
  const a = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!a) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(a.bytes), {
    headers: {
      'Content-Type': a.mime,
      'Cache-Control': 'public,max-age=31536000,immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
