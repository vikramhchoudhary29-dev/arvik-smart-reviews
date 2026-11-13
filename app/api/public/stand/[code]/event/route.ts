import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { z } from 'zod';
import { activeStand, unavailable, limited } from '@/lib/http';
import { recordEvent } from '@/lib/events';
export const POST = route(async (r, c) => {
  if (await limited(r, 'events', 100))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const { code } = await c.params;
  const { type, eventId } = z
    .object({
      type: z.enum(['PAGE_VIEW', 'GOOGLE_LINK_CLICK', 'COPY_SUGGESTION']),
      eventId: z.uuid(),
    })
    .strict()
    .parse(await r.json());
  const stand = await activeStand(code);
  if (!stand) return unavailable();
  await recordEvent(stand, type, eventId);
  return NextResponse.json({ ok: true });
});
