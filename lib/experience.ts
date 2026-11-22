import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { z } from 'zod';

export const staffSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    role: z.string().trim().max(80).default(''),
    active: z.boolean().default(true),
  })
  .strict();
export const experienceSchema = z
  .object({
    staffEnabled: z.boolean(),
    staffQuestion: z.string().trim().max(180),
  })
  .strict();
const questions: Record<string, string> = {
  hotel: 'Who helped you during your stay?',
  restaurant: 'Who served you?',
  jewellery: 'Who helped you choose your jewellery?',
  salon: 'Who provided your service?',
  clinic: 'Who would you like to mention from your visit?',
  retail: 'Who assisted you?',
  automobile: 'Who helped with your vehicle service?',
  education: 'Which teacher or trainer would you like to mention?',
  optical: 'Who helped you during your visit?',
  professional: 'Who assisted you?',
};
export const staffQuestion = (category: string) =>
  questions[category] || 'Who would you like to mention?';
export const experiencePrompt = (category: string) =>
  ({
    restaurant: 'How was your dining experience?',
    hotel: 'How was your stay?',
    jewellery: 'How was your shopping experience?',
    salon: 'How was your salon experience?',
    clinic: 'How was your visit?',
    education: 'How was your learning experience?',
  })[category] || 'How was your experience?';

// Load staff/config once per lookup, rather than repeating database queries per outlet.
export async function publicExperience(businessId: string) {
  try {
    const config = await prisma.businessExperience.findUnique({ where: { businessId } });
    const staff = config?.staffEnabled
      ? await prisma.staffMember.findMany({
          where: { businessId, active: true, deletedAt: null },
          select: { id: true, name: true, role: true, outletId: true },
          orderBy: { name: 'asc' },
          take: 100,
        })
      : [];
    return (category: string, outletId: string | null = null) => ({
      staffEnabled: config?.staffEnabled || false,
      staffQuestion: config?.staffQuestion || staffQuestion(category),
      staff: staff
        .filter((s) => s.outletId === outletId)
        .map(({ id, name, role }) => ({ id, name, role })),
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2021') throw e;
    return (category: string, _outletId: string | null = null) => ({
      staffEnabled: false,
      staffQuestion: staffQuestion(category),
      staff: [],
    });
  }
}

export function mentionStaff(drafts: string[], staff: { name: string; role: string } | null) {
  // Neutral attribution never invents praise, a rating, treatment or a service outcome.
  if (!staff) return drafts;
  const mention = `I interacted with ${staff.name}${staff.role ? ' (' + staff.role + ')' : ''}.`;
  return drafts.map((draft) => `${draft} ${mention}`);
}
