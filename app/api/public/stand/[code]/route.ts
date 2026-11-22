import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import { activeStand, unavailable, limited } from '@/lib/http';
import { googleReviewUrl } from '@/lib/validation';
import { categories } from '@/lib/categories';
import { publicExperience, experiencePrompt } from '@/lib/experience';
export const GET = route(async (r, c) => {
  if (await limited(r, 'lookup', 120))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const { code } = await c.params;
  const stand = await activeStand(code);
  if (!stand || !googleReviewUrl(stand.business.googleReviewUrl)) return unavailable();
  const b = stand.business;
  const outlets = await prisma.outlet.findMany({
    where: { businessId: b.id, active: true },
    select: { id: true, name: true, category: true },
    orderBy: { name: 'asc' },
  });
  const experience = await publicExperience(b.id);
  const experiences = outlets.map((o) => ({
    ...o,
    aspects: categories[o.category] || categories.general,
    experiencePrompt: experiencePrompt(o.category),
    ...experience(o.category, o.id),
  }));
  return NextResponse.json(
    {
      outlets: experiences,
      defaultOutletId: outlets.some((o) => o.id === stand.outletId) ? stand.outletId : null,
      businessName: b.name,
      location: [b.city, b.state].filter(Boolean).join(', '),
      experiencePrompt: experiencePrompt(b.category),
      ...experience(b.category),
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
