import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { z } from 'zod';
import { activeStand, unavailable, limited } from '@/lib/http';
import { categories } from '@/lib/categories';
import { reviewSuggestions } from '@/lib/review-suggestions';
import { recordEvent } from '@/lib/events';
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
    })
    .strict()
    .parse(await r.json());
  const stand = await activeStand(code);
  if (!stand) return unavailable();
  if (
    input.aspects.some(
      (a) => !(categories[stand.business.category] || categories.general).includes(a),
    )
  )
    return NextResponse.json({ error: 'Invalid aspect' }, { status: 400 });
  const phrases = await prisma.reviewPhrase.findMany({
    where: { active: true, category: stand.business.category, sentiment: input.sentiment },
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
  await recordEvent(
    stand,
    input.variation ? 'SUGGESTION_REGENERATE' : 'SUGGESTION_GENERATE',
    input.eventId,
  );
  return NextResponse.json({ suggestions });
});
