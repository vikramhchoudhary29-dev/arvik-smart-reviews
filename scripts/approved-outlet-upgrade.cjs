// One-time, explicitly approved upgrade. Not part of the normal build command.
// Backup rows are emitted only as authenticated ciphertext; the private key stays local.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
// Exact hashes of the unchanged original Windows files (some have mixed LF/CRLF).
const originalWindowsChecksums = {
  '20261111063631_init': '21a015d4b3426af20dd114109d6aaf1d363d940b876a9b55b66e1cfdef4010a9',
  '20261112090000_complete_reviews':
    'd4d1c401312b8690df82781c17c45da9e184df46ad5fb10e2e1aef1116ad45a7',
  '20261112170000_analytics_time_index':
    '02c92901f988ae460068f9be5be146d2edde3631a42f3815b3cbfdd37c69a9f0',
  '20261116090000_business_owner_experience':
    'fe5c57a9c389eabc4d496a9a7086354b62158c39fb10a2f88d21dbe19db1a007',
  '20261117090000_yearly_subscriptions_staff_removal':
    '26b76237edb182607c1c4fc12fa2775533b92afdadc7168e83f712156c032a4c',
};
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
  const publicKey = crypto.createPublicKey(
    process.argv[3].startsWith('@')
      ? fs.readFileSync(process.argv[3].slice(1), 'utf8')
      : Buffer.from(process.argv[3], 'base64').toString(),
  );
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
      if (!local.includes(h.migration_name)) throw Error('Unknown applied migration');
      const sql = fs.readFileSync(`prisma/migrations/${h.migration_name}/migration.sql`, 'utf8');
      const lf = sql.replace(/\r\n/g, '\n');
      const hashes = [sql, lf, lf.replace(/\n/g, '\r\n')].map((text) =>
        crypto.createHash('sha256').update(text).digest('hex'),
      );
      if (!hashes.includes(h.checksum) && originalWindowsChecksums[h.migration_name] !== h.checksum)
        throw Error('Migration history mismatch: ' + h.migration_name);
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
