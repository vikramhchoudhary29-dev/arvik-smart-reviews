export const eventNames = {
  PAGE_VIEW: 'Review page visits',
  SUGGESTION_GENERATE: 'Suggestions generated',
  SUGGESTION_REGENERATE: 'Regenerations',
  COPY_SUGGESTION: 'Review copies',
  GOOGLE_LINK_CLICK: 'Google review page clicks',
} as const;
export type EventName = keyof typeof eventNames;
export type Counts = {
  visits: number;
  generations: number;
  regenerations: number;
  copies: number;
  clicks: number;
};
export const emptyCounts = (): Counts => ({
  visits: 0,
  generations: 0,
  regenerations: 0,
  copies: 0,
  clicks: 0,
});
export const countKey: Record<EventName, keyof Counts> = {
  PAGE_VIEW: 'visits',
  SUGGESTION_GENERATE: 'generations',
  SUGGESTION_REGENERATE: 'regenerations',
  COPY_SUGGESTION: 'copies',
  GOOGLE_LINK_CLICK: 'clicks',
};
export function percent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (100 * numerator) / denominator : null;
}
export function formatPercent(value: number | null) {
  return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';
}
export type AnalyticsFilters = {
  preset: string;
  from: string;
  to: string;
  businessId: string;
  standId: string;
  interval: 'daily' | 'weekly' | 'monthly';
  timezone: 'UTC';
};
export type Performance = Counts & {
  id: string;
  name: string;
  status: string;
  code?: string;
  businessName?: string;
  ctr: number | null;
  share: number | null;
};
export type SeriesPoint = Counts & { period: string };
export type AnalyticsSnapshot = {
  generatedAt: string;
  inventoryScope?: 'business' | 'platform';
  filters: AnalyticsFilters;
  inventory: {
    totalBusinesses: number;
    activeBusinesses: number;
    inactiveBusinesses: number;
    totalStands: number;
    activeStands: number;
    inactiveStands: number;
  };
  activity: Counts & { ctr: number | null };
  series: SeriesPoint[];
  businessRows: Performance[];
  standRows: Performance[];
  options: {
    businesses: { id: string; name: string }[];
    stands: { id: string; name: string; code: string; businessId: string }[];
  };
  recent: {
    id: string;
    type: EventName;
    createdAt: string;
    businessName: string;
    standName: string;
  }[];
  templateUsage: { supported: false; reason: string };
  notes: string[];
};
export const reportKinds = [
  'overview',
  'business',
  'stand',
  'funnel',
  'daily',
  'templates',
] as const;
export type ReportKind = (typeof reportKinds)[number];
export const reportTitles: Record<ReportKind, string> = {
  overview: 'Overview report',
  business: 'Business performance report',
  stand: 'Stand performance report',
  funnel: 'Review funnel report',
  daily: 'Date-wise activity report',
  templates: 'Template usage report',
};
export type Cell = string | number | null;
export type ReportTable = {
  columns: { key: string; label: string; percentage?: boolean }[];
  rows: Record<string, Cell>[];
  title: string;
};
export function funnelRows(data: AnalyticsSnapshot) {
  const a = data.activity;
  return [
    { stage: 'Review page visits', count: a.visits },
    { stage: 'Suggestion generations', count: a.generations },
    { stage: 'Review copies', count: a.copies },
    { stage: 'Google outbound clicks', count: a.clicks },
  ].map((r) => ({ ...r, visitRatio: percent(r.count, a.visits) }));
}
export function reportTable(data: AnalyticsSnapshot, kind: ReportKind): ReportTable {
  const metrics = [
    { key: 'visits', label: 'Visits' },
    { key: 'generations', label: 'Generated' },
    { key: 'regenerations', label: 'Regenerated' },
    { key: 'copies', label: 'Copies' },
    { key: 'clicks', label: 'Google clicks' },
  ];
  const rate = { key: 'ctr', label: 'Click / visit ratio', percentage: true };
  if (kind === 'business' || kind === 'stand')
    return {
      title: reportTitles[kind],
      columns: [
        { key: 'name', label: kind === 'business' ? 'Business' : 'Stand' },
        ...(kind === 'stand'
          ? [
              { key: 'businessName', label: 'Current business' },
              { key: 'code', label: 'Permanent code' },
            ]
          : []),
        { key: 'status', label: 'Current status' },
        ...metrics,
        rate,
        { key: 'share', label: 'Share of clicks', percentage: true },
      ],
      rows: (kind === 'business' ? data.businessRows : data.standRows).map((r) => ({ ...r })),
    };
  if (kind === 'daily')
    return {
      title: reportTitles[kind],
      columns: [{ key: 'period', label: 'Period start (UTC)' }, ...metrics, rate],
      rows: data.series.map((r) => ({ ...r, ctr: percent(r.clicks, r.visits) })),
    };
  if (kind === 'funnel')
    return {
      title: reportTitles[kind],
      columns: [
        { key: 'stage', label: 'Interaction stage' },
        { key: 'count', label: 'Events' },
        { key: 'visitRatio', label: 'Events / visits', percentage: true },
      ],
      rows: funnelRows(data),
    };
  if (kind === 'templates')
    return {
      title: reportTitles[kind],
      columns: [{ key: 'status', label: 'Availability' }],
      rows: [{ status: data.templateUsage.reason }],
    };
  return {
    title: reportTitles.overview,
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
      { key: 'scope', label: 'Scope / definition' },
    ],
    rows: [
      ...Object.entries(data.inventory).map(([key, value]) => ({
        metric: (
          {
            totalBusinesses: 'Total businesses',
            activeBusinesses: 'Active businesses',
            inactiveBusinesses: 'Inactive businesses',
            totalStands: 'Total NFC/QR stands',
            activeStands: 'Active stands',
            inactiveStands: 'Inactive stands',
          } as Record<string, string>
        )[key],
        value,
        scope:
          data.inventoryScope === 'business'
            ? 'Selected business current inventory; unaffected by activity dates'
            : 'Platform-wide current inventory; unaffected by filters',
      })),
      ...metrics.map((c) => ({
        metric: c.label,
        value: data.activity[c.key as keyof Counts],
        scope: 'Selected date range and entity filters; event counts',
      })),
      {
        metric: 'Google click-through rate',
        value: data.activity.ctr === null ? 'N/A' : formatPercent(data.activity.ctr),
        scope:
          'Google outbound clicks / page visits × 100; event ratio, not unique people or published reviews',
      },
    ],
  };
}
export function selectReportRows(
  table: ReportTable,
  query: string,
  sort: string,
  direction: 'asc' | 'desc',
) {
  const column = table.columns.find((c) => c.key === sort) || table.columns[0];
  const needle = query.trim().toLocaleLowerCase('en-US');
  const rows = table.rows.filter((row) =>
    table.columns.some((c) => {
      const value = row[c.key];
      const visible = c.percentage
        ? formatPercent(value as number | null)
        : typeof value === 'number'
          ? value.toLocaleString('en-US')
          : value === null
            ? 'N/A —'
            : String(value ?? '');
      return (visible + ' ' + String(value ?? '')).toLocaleLowerCase('en-US').includes(needle);
    }),
  );
  return rows.sort((a, b) => {
    const x = a[column.key],
      y = b[column.key];
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
    if (y === null || y === undefined) return -1;
    const value =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'en', { numeric: true });
    return direction === 'asc' ? value : -value;
  });
}
