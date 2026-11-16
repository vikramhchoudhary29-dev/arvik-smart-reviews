import { assignedBusiness, businessRoute, denied, privateJson } from '@/lib/business-access';
import { analyticsSnapshot } from '@/lib/analytics-server';
export const GET = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  return privateJson(await analyticsSnapshot(r.nextUrl.searchParams, new Date(), businessId));
});
