import { route } from '@/lib/http';
import { uploadImage } from '@/lib/image-upload';
export const POST = route(uploadImage, true);
