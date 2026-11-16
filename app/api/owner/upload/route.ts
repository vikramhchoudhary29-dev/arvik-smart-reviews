import { assignedBusiness, businessRoute, denied } from '@/lib/business-access';
import { uploadImage } from '@/lib/image-upload';
export const POST = businessRoute(async (r, identity) => {
  const businessId = r.nextUrl.searchParams.get('businessId') || '';
  if (!(await assignedBusiness(identity.uid, businessId))) return denied();
  return uploadImage(r);
});
