import { PrismaClient } from '@prisma/client';
import { seed } from '../lib/seed';
const db = new PrismaClient();
seed(db).finally(() => db.$disconnect());
