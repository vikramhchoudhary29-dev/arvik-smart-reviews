'use client';
import { readApiResponse } from '@/lib/api-response';
import type { AnalyticsSnapshot } from '@/lib/analytics-model';
import { Shell, api } from './admin';
import { AnalyticsWorkspace } from './analytics-workspace';
import { clientAuth } from '@/lib/firebase-client';
export { SettingsPage } from './settings';
export async function downloadReport(query: URLSearchParams) {
  const token = await clientAuth().currentUser?.getIdToken();
  if (!token) throw Error('Please sign in again.');
  const r = await fetch('/api/admin/reports?' + query, {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  if (!r.ok) await readApiResponse(r);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download =
    r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'arvik-report';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const loadSnapshot = (query: URLSearchParams) =>
  api<AnalyticsSnapshot>('/api/admin/analytics?' + query);
export function ReportPage({
  dashboard = false,
  dedicated = false,
}: {
  dashboard?: boolean;
  dedicated?: boolean;
}) {
  return (
    <Shell section={dashboard ? '' : dedicated ? 'reports' : 'analytics'}>
      <AnalyticsWorkspace
        dashboard={dashboard}
        loadSnapshot={loadSnapshot}
        exportReport={downloadReport}
      />
    </Shell>
  );
}
