import { PrismaClient } from '@prisma/client';
import { categories } from './categories';
export async function seed(db: PrismaClient) {
  for (const category of Object.keys(categories))
    for (const [sentiment, texts] of Object.entries({
      positive: [
        'I was happy with the {aspect}.',
        'The {aspect} met my expectations.',
        'I had a positive experience with the {aspect}.',
      ],
      neutral: [
        'The {aspect} was okay.',
        'My experience with the {aspect} was average.',
        'I have mixed feelings about the {aspect}.',
      ],
      critical: [
        'The {aspect} could be improved.',
        'I was disappointed with the {aspect}.',
        'The {aspect} did not meet my expectations.',
      ],
    }))
      for (let i = 0; i < texts.length; i++) {
        const id = 'starter-' + category + '-' + sentiment + '-' + i;
        await db.reviewPhrase.upsert({
          where: { id },
          create: { id, category, tag: '*', sentiment, text: texts[i] },
          update: {},
        });
      }
}
