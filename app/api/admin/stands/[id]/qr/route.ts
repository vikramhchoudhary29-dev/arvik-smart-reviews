import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import QRCode from 'qrcode';
export const GET = route(async (r, c) => {
  const { id } = await c.params;
  const stand = await prisma.stand.findUniqueOrThrow({ where: { id } });
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  if (base.protocol !== 'https:' && base.hostname !== 'localhost')
    throw Error('HTTPS app URL required');
  const url = new URL('/r/' + stand.code, base).toString();
  const svg = r.nextUrl.searchParams.get('format') === 'svg';
  const data = svg
    ? await QRCode.toString(url, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', width: 600 })
    : await QRCode.toBuffer(url, { margin: 4, errorCorrectionLevel: 'M', width: 1200 });
  return new Response(typeof data === 'string' ? data : new Uint8Array(data), {
    headers: {
      'Content-Type': svg ? 'image/svg+xml' : 'image/png',
      'Content-Disposition':
        'attachment; filename="stand-' + stand.code + '.' + (svg ? 'svg' : 'png') + '"',
    },
  });
}, true);
