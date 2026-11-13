import { NextResponse } from 'next/server';
import { route } from '@/lib/http';
import { analyticsSnapshot } from '@/lib/analytics-server';
export const GET = route(
  async (r) =>
    NextResponse.json(await analyticsSnapshot(r.nextUrl.searchParams), {
      headers: { 'Cache-Control': 'private, no-store' },
    }),
  true,
);
