import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annualExpiry,
  periodStatus,
  renewalWhatsAppLink,
  rupeesToPaise,
} from '../lib/subscription-model';
test('yearly inclusive dates, leap years and warning statuses are deterministic', () => {
  assert.equal(annualExpiry('2026-11-17'), '2027-11-16');
  assert.equal(annualExpiry('2024-02-29'), '2025-02-28');
  assert.equal(
    periodStatus('2026-01-01', '2026-12-31', new Date('2026-12-31T23:59:59Z')).status,
    'EXPIRING_SOON',
  );
  assert.equal(
    periodStatus('2026-01-01', '2026-12-31', new Date('2027-01-01T00:00:00Z')).status,
    'EXPIRED',
  );
  assert.equal(
    periodStatus('2027-01-01', '2027-12-31', new Date('2026-12-31T00:00:00Z')).status,
    'UPCOMING',
  );
  assert.equal(
    periodStatus('2026-01-01', '2026-12-31', new Date('2026-11-01T00:00:00Z')).status,
    'ACTIVE',
  );
});
test('INR input uses exact paise and renewal links are manual WhatsApp composers', () => {
  assert.equal(rupeesToPaise('2999.99'), 299999);
  assert.equal(rupeesToPaise('0'), 0);
  for (const bad of ['-1', '1.001', 'Infinity', '1e4', '1000000000'])
    assert.throws(() => rupeesToPaise(bad));
  const url = renewalWhatsAppLink('9999999999', 'Cafe & Co', {
    expiresOn: '2027-11-16',
    annualFeePaise: 299900,
  });
  assert.ok(url?.startsWith('https://wa.me/919999999999?text='));
  assert.ok(decodeURIComponent(url!).includes('Cafe & Co'));
  assert.ok(
    !renewalWhatsAppLink('invalid', 'Cafe', { expiresOn: '2027-01-01', annualFeePaise: 100 }),
  );
});
