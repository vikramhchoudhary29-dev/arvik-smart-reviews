import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { analyticsSnapshot } from '@/lib/analytics-server';
import { reportKinds } from '@/lib/analytics-model';
import { reportCsv, reportXlsx } from '@/lib/report-export';
export async function exportAnalyticsReport(r: NextRequest, scopeBusinessId?: string) {
  const q = r.nextUrl.searchParams;
  const kind = z.enum(reportKinds).parse(q.get('report') || 'overview');
  const format = z.enum(['csv', 'xlsx']).parse(q.get('format') || 'csv');
  if (kind === 'templates')
    return NextResponse.json(
      { error: 'Template usage was not recorded. No usage report can be exported.' },
      { status: 409 },
    );
  const query = z
    .string()
    .max(200)
    .parse(q.get('search') || '');
  const sort = z
    .string()
    .max(50)
    .parse(q.get('sort') || 'name');
  const direction = z.enum(['asc', 'desc']).parse(q.get('direction') || 'desc');
  const data = await analyticsSnapshot(q, new Date(), scopeBusinessId);
  const body =
    format === 'csv'
      ? reportCsv(data, kind, query, sort, direction)
      : new Uint8Array(reportXlsx(data, kind, query, sort, direction));
  return new Response(body, {
    headers: {
      'Content-Type':
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="arvik-' +
        kind +
        '-' +
        data.filters.from +
        '-' +
        data.filters.to +
        '.' +
        format +
        '"',
      'Cache-Control': 'private, no-store',
      'X-Report-Generated-At': data.generatedAt,
    },
  });
}
