import { assignedBusiness, businessRoute, denied } from '@/lib/business-access';
import { outletRequest } from '@/lib/outlets';
const handler = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  return outletRequest(r, businessId, identity.email);
});
export const GET = handler;
export const POST = handler;
