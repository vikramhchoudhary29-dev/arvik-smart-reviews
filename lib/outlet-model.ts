import { z } from 'zod';
import { categories } from './categories';
export const outletSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    category: z.enum(Object.keys(categories) as [string, ...string[]]),
    active: z.boolean(),
  })
  .strict();
export const outletAction = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('save'), id: z.string().max(100).optional(), values: outletSchema })
    .strict(),
  z
    .object({
      action: z.literal('staff'),
      staffId: z.string().min(1),
      outletId: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('stand'),
      standId: z.string().min(1),
      outletId: z.string().nullable(),
    })
    .strict(),
]);
