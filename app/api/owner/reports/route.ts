import { assignedBusiness, businessRoute, denied } from '@/lib/business-access';
import { exportAnalyticsReport } from '@/lib/export-handler';
export const GET = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  return exportAnalyticsReport(r, businessId);
});
