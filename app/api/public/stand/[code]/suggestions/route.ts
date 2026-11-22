import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { z } from 'zod';
import { activeStand, unavailable, limited } from '@/lib/http';
import { categories } from '@/lib/categories';
import { reviewSuggestions } from '@/lib/review-suggestions';
import { recordEvent } from '@/lib/events';
import { mentionStaff } from '@/lib/experience';
export const POST = route(async (r, c) => {
  if (await limited(r, 'suggestions', 20))
    return NextResponse.json(
      { error: 'Please wait a minute before generating again.' },
      { status: 429 },
    );
  const { code } = await c.params;
  const input = z
    .object({
      aspects: z.array(z.string()).max(6),
      sentiment: z.enum(['positive', 'neutral', 'critical']),
      notes: z.string().max(1500),
      variation: z.number().int().min(0).max(100000),
      eventId: z.uuid(),
      outletId: z.string().max(100).optional(),
      staffId: z.string().max(100).optional(),
    })
    .strict()
    .parse(await r.json());
  const stand = await activeStand(code);
  if (!stand) return unavailable();
  const outlet = input.outletId
    ? await prisma.outlet.findFirst({
        where: { id: input.outletId, businessId: stand.businessId, active: true },
      })
    : null;
  if (input.outletId && !outlet)
    return NextResponse.json(
      { error: 'Outlet unavailable. Please select again.' },
      { status: 400 },
    );
  const category = outlet?.category || stand.business.category;
  let staff = null;
  if (input.staffId) {
    const config = await prisma.businessExperience.findUnique({
      where: { businessId: stand.businessId },
    });
    staff = config?.staffEnabled
      ? await prisma.staffMember.findFirst({
          where: {
            id: input.staffId,
            businessId: stand.businessId,
            active: true,
            deletedAt: null,
            outletId: outlet?.id || null,
          },
          select: { id: true, name: true, role: true },
        })
      : null;
    if (!staff)
      return NextResponse.json(
        { error: 'That staff member is no longer available. Please update your selection.' },
        { status: 400 },
      );
  }
  if (input.aspects.some((a) => !(categories[category] || categories.general).includes(a)))
    return NextResponse.json({ error: 'Invalid aspect' }, { status: 400 });
  let phrases = await prisma.reviewPhrase.findMany({
    where: {
      active: true,
      category,
      sentiment: input.sentiment,
    },
  });
  if (!phrases.length && ['cafe', 'bar', 'thali'].includes(category))
    phrases = await prisma.reviewPhrase.findMany({
      where: { active: true, category: 'general', sentiment: input.sentiment },
    });
  let suggestions;
  try {
    suggestions = reviewSuggestions(
      [...new Set(input.aspects)],
      input.sentiment,
      input.notes,
      phrases,
      input.variation,
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  suggestions = mentionStaff(suggestions, staff);
  if (outlet) suggestions = suggestions.map((draft) => `At ${outlet.name}: ${draft}`);
  await recordEvent(
    stand,
    input.variation ? 'SUGGESTION_REGENERATE' : 'SUGGESTION_GENERATE',
    input.eventId,
    staff?.id,
    outlet?.id,
  );
  return NextResponse.json({ suggestions });
});
