// One-time, explicitly approved upgrade. Not part of the normal build command.
// Backup rows are emitted only as authenticated ciphertext; the private key stays local.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const migration = '20261122090000_business_outlets';
const tables = [
  'Business',
  'Stand',
  'ReviewPhrase',
  'AnalyticsEvent',
  'BusinessOwner',
  'BusinessExperience',
  'StaffMember',
  'StaffMention',
  'SubscriptionPeriod',
  'SubscriptionPayment',
  'Customer',
  'LoyaltyProgram',
  'StampTransaction',
  'RewardRedemption',
];
async function main() {
  if (
    process.env.VERCEL_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') !== 'https://arvik-smart-reviews.vercel.app'
  )
    throw Error('Wrong deployment environment');
  if (process.argv[2] !== migration || !process.argv[3])
    throw Error('Explicit approved migration and backup public key required');
  const publicKey = crypto.createPublicKey(Buffer.from(process.argv[3], 'base64').toString());
  const url = new URL(process.env.DATABASE_URL);
  if (!url.hostname.endsWith('.neon.tech')) throw Error('Wrong database provider');
  url.hostname = url.hostname.replace('-pooler.', '.');
  url.searchParams.delete('pgbouncer');
  process.env.DATABASE_URL = url.toString();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  try {
    const history = await db.$queryRawUnsafe(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
    );
    if (history.some((h) => !h.finished_at && !h.rolled_back_at))
      throw Error('Unfinished database migration');
    const local = fs
      .readdirSync('prisma/migrations')
      .filter((m) => m !== 'migration_lock.toml')
      .sort();
    for (const h of history.filter((h) => h.finished_at && !h.rolled_back_at)) {
      if (
        !local.includes(h.migration_name) ||
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(`prisma/migrations/${h.migration_name}/migration.sql`))
          .digest('hex') !== h.checksum
      )
        throw Error('Migration history mismatch');
    }
    const pending = local.filter(
      (m) => !history.some((h) => h.migration_name === m && h.finished_at && !h.rolled_back_at),
    );
    if (
      !pending.length &&
      history.some((h) => h.migration_name === migration && h.finished_at && !h.rolled_back_at)
    ) {
      console.log(
        'OUTLET_UPGRADE_REPORT ' +
          JSON.stringify({ migration, alreadyApplied: true, outletCount: await db.outlet.count() }),
      );
      return;
    }
    if (JSON.stringify(pending) !== JSON.stringify([migration]))
      throw Error('Unexpected pending migration set');
    const existing = await db.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='Outlet'`,
    );
    if (existing.length) throw Error('Outlet table exists outside migration history');
    const backup = { createdAt: new Date().toISOString(), tables: {} };
    for (const table of tables)
      backup.tables[table] = await db.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    const plain = Buffer.from(JSON.stringify(backup));
    const key = crypto.randomBytes(32),
      iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
    const envelope = Buffer.from(
      JSON.stringify({
        key: crypto.publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, key).toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64'),
        sha256: crypto.createHash('sha256').update(plain).digest('hex'),
      }),
    ).toString('base64');
    const chunks = envelope.match(/.{1,512}/g);
    chunks.forEach((chunk, i) => console.log(`OUTLET_BACKUP ${i + 1}/${chunks.length} ${chunk}`));
    // Only the single reviewed pending migration can be applied.
    const result = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: process.env, encoding: 'utf8' },
    );
    if (result.status !== 0)
      throw Error('Approved migration command failed; inspect migration history before retrying');
    const counts = {},
      concurrentChanges = {};
    for (const [table, originals] of Object.entries(JSON.parse(plain.toString()).tables)) {
      const rows = JSON.parse(JSON.stringify(await db.$queryRawUnsafe(`SELECT * FROM "${table}"`)));
      counts[table] = rows.length;
      const primary = table === 'BusinessExperience' ? 'businessId' : 'id';
      const current = new Map(rows.map((row) => [row[primary], row]));
      for (const original of originals) {
        const row = current.get(original[primary]);
        if (!row) throw Error('Missing preserved record in ' + table);
        for (const field of Object.keys(original))
          if (JSON.stringify(row[field]) !== JSON.stringify(original[field])) {
            // Real customer traffic may update stand activity while the additive upgrade runs.
            if (table === 'Stand' && ['lastActivity', 'updatedAt'].includes(field)) {
              concurrentChanges[field] = (concurrentChanges[field] || 0) + 1;
              continue;
            }
            throw Error('Original field changed in ' + table + '.' + field);
          }
      }
    }
    const outletCount = await db.outlet.count();
    const assigned = await db.$queryRawUnsafe(
      `SELECT (SELECT COUNT(*) FROM "Stand" WHERE "outletId" IS NOT NULL) + (SELECT COUNT(*) FROM "StaffMember" WHERE "outletId" IS NOT NULL) + (SELECT COUNT(*) FROM "AnalyticsEvent" WHERE "outletId" IS NOT NULL) AS count`,
    );
    if (outletCount || Number(assigned[0].count))
      throw Error('Unexpected prepopulated outlet data');
    console.log(
      'OUTLET_UPGRADE_REPORT ' +
        JSON.stringify({
          migration,
          applied: true,
          originalRecordsPreserved: true,
          counts,
          outletCount,
          historicalOutletIdsRemainNull: true,
          concurrentStandActivityChanges: concurrentChanges,
          backupSha256: crypto.createHash('sha256').update(plain).digest('hex'),
          verifiedAt: new Date().toISOString(),
        }),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    'OUTLET_UPGRADE_FAILED',
    e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[redacted]') : 'Unknown',
  );
  process.exit(1);
});
