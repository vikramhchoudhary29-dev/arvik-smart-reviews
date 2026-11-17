import { assignedBusiness, businessRoute, denied, privateJson } from '@/lib/business-access';
import { subscriptionDetails } from '@/lib/subscriptions';
export const GET = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  return privateJson(await subscriptionDetails(businessId));
});
