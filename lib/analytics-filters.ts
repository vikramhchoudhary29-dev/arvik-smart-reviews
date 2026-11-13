import { z } from 'zod';
import type { AnalyticsFilters, SeriesPoint } from './analytics-model';
import { emptyCounts } from './analytics-model';
const dayMs = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function parseAnalyticsFilters(q: URLSearchParams, now = new Date()): AnalyticsFilters {
  const preset = z
    .enum(['today', 'last7', 'last30', 'month', 'custom'])
    .parse(q.get('preset') || (q.has('from') || q.has('to') ? 'custom' : 'last30'));
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  let start = new Date(today),
    end = new Date(today);
  if (preset === 'last7') start = new Date(today.getTime() - 6 * dayMs);
  if (preset === 'last30') start = new Date(today.getTime() - 29 * dayMs);
  if (preset === 'month') start.setUTCDate(1);
  if (preset === 'custom') {
    start = new Date(z.iso.date().parse(q.get('from')) + 'T00:00:00Z');
    end = new Date(z.iso.date().parse(q.get('to')) + 'T00:00:00Z');
  }
  if (start > end || (end.getTime() - start.getTime()) / dayMs >= 366)
    throw new z.ZodError([
      {
        code: 'custom',
        message: 'Choose an ordered date range of up to 366 calendar days.',
        path: ['from'],
      },
    ]);
  return {
    preset,
    from: iso(start),
    to: iso(end),
    businessId: z
      .string()
      .max(100)
      .parse(q.get('businessId') || ''),
    standId: z
      .string()
      .max(100)
      .parse(q.get('standId') || ''),
    interval: z.enum(['daily', 'weekly', 'monthly']).parse(q.get('interval') || 'daily'),
    timezone: 'UTC',
  };
}
export function timeBounds(filters: AnalyticsFilters) {
  return {
    gte: new Date(filters.from + 'T00:00:00Z'),
    lt: new Date(new Date(filters.to + 'T00:00:00Z').getTime() + dayMs),
  };
}
export function periodKey(day: string, interval: AnalyticsFilters['interval']) {
  const d = new Date(day + 'T00:00:00Z');
  if (interval === 'monthly') return day.slice(0, 7) + '-01';
  if (interval === 'weekly') {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return iso(d);
  }
  return day;
}
export function aggregateSeries(daily: SeriesPoint[], filters: AnalyticsFilters): SeriesPoint[] {
  const buckets = new Map<string, SeriesPoint>();
  for (
    let d = new Date(filters.from + 'T00:00:00Z');
    iso(d) <= filters.to;
    d = new Date(d.getTime() + dayMs)
  ) {
    const key = periodKey(iso(d), filters.interval);
    if (!buckets.has(key)) buckets.set(key, { period: key, ...emptyCounts() });
  }
  for (const day of daily) {
    const target = buckets.get(periodKey(day.period, filters.interval));
    if (target)
      for (const key of Object.keys(emptyCounts()) as (keyof ReturnType<typeof emptyCounts>)[])
        target[key] += day[key];
  }
  return [...buckets.values()];
}
