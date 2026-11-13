import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const [command, ...args] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(command)) {
  console.error('Usage: node scripts/run-next.mjs dev|build|start [Next.js arguments]');
  process.exit(1);
}
const cwd = fileURLToPath(new URL('../', import.meta.url));
let needsGeneration = command !== 'start';
if (!needsGeneration) {
  try {
    const { PrismaClient } = require('@prisma/client');
    const probe = new PrismaClient();
    await probe.$disconnect();
  } catch {
    needsGeneration = true;
  }
}
if (needsGeneration) {
  // Explicit main-command step: works even when npm install lifecycle scripts were skipped.
  // Generation writes local client files only; it never migrates or queries the database.
  const generated = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'generate'],
    {
      cwd,
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (generated.error || generated.status !== 0) {
    console.error(
      'Prisma Client generation failed. Resolve the error above before starting Next.js.',
    );
    process.exit(generated.status || 1);
  }
}
const next = spawnSync(
  process.execPath,
  [require.resolve('next/dist/bin/next'), command, ...args],
  { cwd, stdio: 'inherit', env: process.env },
);
if (next.error) {
  console.error('Could not start Next.js:', next.error.message);
  process.exit(1);
}
process.exit(next.status ?? 1);
