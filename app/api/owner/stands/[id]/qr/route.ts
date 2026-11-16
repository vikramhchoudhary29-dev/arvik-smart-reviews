import { assignedBusiness, businessRoute, denied } from '@/lib/business-access';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
export const GET = businessRoute(async (r, identity, c) => {
  const { id } = await c.params;
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  const stand = await prisma.stand.findFirst({ where: { id, businessId } });
  if (!stand) return denied();
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL || r.nextUrl.origin);
  const url = new URL('/r/' + encodeURIComponent(stand.code), base).toString();
  const bytes = await QRCode.toBuffer(url, { width: 1000, margin: 4, errorCorrectionLevel: 'M' });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="stand-qr.png"',
      'Cache-Control': 'private, no-store',
    },
  });
});
