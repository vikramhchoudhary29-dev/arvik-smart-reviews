import { route } from '@/lib/http';
import { ownerEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { outletRequest } from '@/lib/outlets';
const handler = route(async (r) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await prisma.business.findUnique({ where: { id: businessId } })))
    return Response.json({ error: 'Select a business' }, { status: 400 });
  return outletRequest(r, businessId, ownerEmail(r));
}, true);
export const GET = handler;
export const POST = handler;
