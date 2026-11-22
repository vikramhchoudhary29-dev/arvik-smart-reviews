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
  const { type, eventId, outletId } = z
    .object({
      type: z.enum(['PAGE_VIEW', 'GOOGLE_LINK_CLICK', 'COPY_SUGGESTION']),
      eventId: z.uuid(),
      outletId: z.string().max(100).optional(),
    })
    .strict()
    .parse(await r.json());
  const stand = await activeStand(code);
  if (!stand) return unavailable();
  if (
    outletId &&
    !(await prisma.outlet.findFirst({
      where: { id: outletId, businessId: stand.businessId, active: true },
    }))
  )
    return NextResponse.json({ error: 'Outlet unavailable' }, { status: 400 });
  await recordEvent(stand, type, eventId, undefined, outletId);
  return NextResponse.json({ ok: true });
});
