import { z } from 'zod';
import { categories } from './categories';
export function googleReviewUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return false;
    if (u.hostname === 'g.page') return /^\/(?:r\/)?[A-Za-z0-9_-]+\/review\/?$/.test(u.pathname);
    if (u.hostname === 'search.google.com')
      return u.pathname === '/local/writereview' && !!u.searchParams.get('placeid');

    return false;
  } catch {
    return false;
  }
}
const text = z.string().trim().max(2000);
const image = z.string().regex(/^$|^\/api\/media\/[a-z0-9]+$/);
export const businessSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    googleReviewUrl: z
      .string()
      .max(2048)
      .refine(googleReviewUrl, 'Use an official Google review destination'),
    category: z.enum(Object.keys(categories) as [string, ...string[]]).default('general'),
    contactName: text.default(''),
    phone: text.default(''),
    whatsapp: text.default(''),
    renewalWhatsapp: z
      .string()
      .trim()
      .max(25)
      .refine(
        (v) =>
          !v ||
          (/^[+\d ()-]+$/.test(v) &&
            v.replace(/\D/g, '').length >= 10 &&
            v.replace(/\D/g, '').length <= 15),
        'Use a WhatsApp number with country code',
      )
      .default(''),
    email: z.union([z.literal(''), z.email()]).default(''),
    address: text.default(''),
    city: text.default(''),
    state: text.default(''),
    pincode: text.default(''),
    googleMapsUrl: z
      .union([
        z.literal(''),
        z.url().refine((v) => {
          const u = new URL(v);
          return (
            u.protocol === 'https:' &&
            ['www.google.com', 'google.com', 'maps.google.com', 'maps.app.goo.gl'].includes(
              u.hostname,
            )
          );
        }),
      ])
      .default(''),
    logo: image.default(''),
    coverImage: image.default(''),
    description: text.default(''),
    welcomeMessage: text.default(''),
    internalNotes: text.default(''),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#10b981'),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('INACTIVE'),
    linkTested: z.boolean().optional(),
  })
  .strict();
export const standSchema = z
  .object({
    businessId: z.string().min(1),
    label: z.string().trim().max(80).nullable().optional(),
    type: z.enum(['NFC_QR', 'NFC', 'QR']).default('NFC_QR'),
    location: z.string().trim().max(200).default(''),
    active: z.boolean().default(true),
  })
  .strict();
export const templateSchema = z
  .object({
    category: z.enum(Object.keys(categories) as [string, ...string[]]),
    tag: z.string().min(1).max(80),
    sentiment: z.enum(['positive', 'neutral', 'critical']),
    text: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(
        (s) => s.includes('{aspect}') && !/[{}]/.test(s.replaceAll('{aspect}', '')),
        'Include only the {aspect} placeholder',
      ),
    active: z.boolean().default(true),
  })
  .strict();

export function partialInput<T extends z.ZodRawShape>(schema: z.ZodObject<T>, input: unknown) {
  const parsed = schema.partial().parse(input);
  const keys = Object.keys(input as object);
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => keys.includes(key)),
  ) as typeof parsed;
}
