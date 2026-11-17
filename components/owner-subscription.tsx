'use client';
import { useEffect, useState } from 'react';
import { api } from './admin';
import { money, type Period } from '@/lib/subscription-model';
export function OwnerSubscription({
  businessId,
  full = false,
}: {
  businessId: string;
  full?: boolean;
}) {
  const [data, setData] = useState<{
      current: Period | null;
      next: Period | null;
      periods: Period[];
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void api<typeof data>('/api/owner/subscription?businessId=' + encodeURIComponent(businessId))
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);
  if (!full) {
    const p = data?.current;
    if (!p || !['EXPIRED', 'EXPIRING_SOON'].includes(p.status)) return null;
    return (
      <aside className="notice no-print" role="status">
        <strong>
          {p.status === 'EXPIRED'
            ? 'Your yearly subscription has expired.'
            : 'Your yearly subscription expires soon.'}
        </strong>
        <p>
          Expiry: {p.expiresOn}. Please contact Arvik Digital for renewal. Your review page remains
          active.
        </p>
        {data?.next && <p>Next term scheduled from {data.next.startsOn}.</p>}
      </aside>
    );
  }
  return (
    <>
      <p className="eyebrow">YOUR YEARLY PLAN</p>
      <h1>Subscription</h1>
      <p className="muted">
        Expiry warnings only. Your NFC/QR review page remains active. Contact Arvik Digital to renew
        or record a payment.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !data ? (
        <div className="skeleton">Loading subscription…</div>
      ) : !data.periods.length ? (
        <p className="panel">
          No yearly subscription configured yet. Contact Arvik Digital for your plan details.
        </p>
      ) : (
        <div className="rows">
          {data.periods.map((p) => (
            <article className="panel" key={p.id}>
              <h2>
                {p.startsOn} → {p.expiresOn}
              </h2>
              <p>
                {p.status.replaceAll('_', ' ')} · {p.paymentStatus}
              </p>
              <p>
                Yearly fee: {money(p.annualFeePaise)} · Paid: {money(p.paidPaise)} · Due:{' '}
                {money(p.duePaise)}
              </p>
              <p className="muted small">
                Dates are UTC, expiry date inclusive. Amounts reflect payments recorded by Super
                Admin.
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
