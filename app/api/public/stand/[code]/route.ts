import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { activeStand, unavailable, limited } from '@/lib/http';
import { googleReviewUrl } from '@/lib/validation';
import { categories } from '@/lib/categories';
export const GET = route(async (r, c) => {
  if (await limited(r, 'lookup', 120))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const { code } = await c.params;
  const stand = await activeStand(code);
  if (!stand || !googleReviewUrl(stand.business.googleReviewUrl)) return unavailable();
  const b = stand.business;
  return NextResponse.json(
    {
      businessName: b.name,
      category: b.category,
      logo: b.logo,
      coverImage: b.coverImage,
      description: b.description,
      welcomeMessage: b.welcomeMessage,
      brandColor: b.brandColor,
      googleReviewUrl: b.googleReviewUrl,
      aspects: categories[b.category] || categories.general,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
