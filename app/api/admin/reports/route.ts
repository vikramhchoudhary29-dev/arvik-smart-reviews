import { route } from '@/lib/http';
import { exportAnalyticsReport } from '@/lib/export-handler';
export const GET = route((r) => exportAnalyticsReport(r), true);
