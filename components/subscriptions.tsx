'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell, api } from './admin';
import {
  isoDay,
  money,
  rupeesToPaise,
  renewalWhatsAppLink,
  annualExpiry,
  type Period,
} from '@/lib/subscription-model';
type BusinessSubscription = {
  id: string;
  name: string;
  status: string;
  renewalWhatsapp: string;
  periods: Period[];
  current: Period | null;
  next: Period | null;
};
export default function SubscriptionsPage() {
  return (
    <Shell section="subscriptions">
      <SubscriptionsManager />
    </Shell>
  );
}
function SubscriptionsManager() {
  const [businesses, setBusinesses] = useState<BusinessSubscription[]>([]),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{
    action: 'create' | 'renew' | 'edit';
    businessId: string;
    startsOn: string;
    fee: string;
    notes: string;
    id?: string;
  } | null>(null);
  const [payment, setPayment] = useState<{
    subscriptionId: string;
    amount: string;
    paidOn: string;
    method: string;
    reference: string;
  } | null>(null);
  async function load() {
    const data = await api<{ businesses: BusinessSubscription[] }>('/api/admin/subscriptions');
    setBusinesses(data.businesses);
  }
  useEffect(() => {
    setSelected(new URLSearchParams(location.search).get('businessId') || '');
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function run(fn: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const business = businesses.find((b) => b.id === selected);
  const shown = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' ||
        (status === 'unpaid'
          ? b.current?.paymentStatus !== 'PAID' && !!b.current
          : (b.current?.status || 'NO_PLAN') === status)),
  );
  function start(action: 'create' | 'renew', b?: BusinessSubscription) {
    const target = b || business || businesses[0];
    if (!target) return;
    setSelected(target.id);
    setForm({
      action,
      businessId: target.id,
      startsOn: isoDay(new Date()),
      fee: target.periods.length ? String(target.periods[0].annualFeePaise / 100) : '',
      notes: '',
    });
    setPayment(null);
    setError('');
  }
  function remind(b: BusinessSubscription, p: Period) {
    return renewalWhatsAppLink(b.renewalWhatsapp, b.name, p);
  }
  return (
    <>
      <p className="eyebrow">YEARLY SUBSCRIPTIONS</p>
      <h1>Subscriptions & renewals</h1>
      <p className="muted">
        One place to manage yearly terms, fees, manual payments and renewal history. Expiry shows a
        warning only; NFC/QR review pages remain active.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="grid subscription-summary">
        {[
          ['Businesses', businesses.length],
          ['Active', businesses.filter((b) => b.current?.status === 'ACTIVE').length],
          [
            'Expiring in 30 days',
            businesses.filter((b) => b.current?.status === 'EXPIRING_SOON').length,
          ],
          ['Expired', businesses.filter((b) => b.current?.status === 'EXPIRED').length],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <p className="muted small">{label}</p>
            <strong className="metric">{value}</strong>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <label>
          Search businesses
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Subscription status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              ['all', 'All'],
              ['ACTIVE', 'Active'],
              ['EXPIRING_SOON', 'Expiring soon'],
              ['EXPIRED', 'Expired'],
              ['UPCOMING', 'Upcoming'],
              ['NO_PLAN', 'Not configured'],
              ['unpaid', 'Unpaid / partial'],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || !businesses.length}
          onClick={() => start('create')}
        >
          Add yearly subscription
        </button>
      </div>
      {loading ? (
        <div className="skeleton">Loading subscriptions…</div>
      ) : !shown.length ? (
        <p className="panel">No matching businesses or subscriptions.</p>
      ) : (
        <div className="table-wrap panel">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Term / expiry</th>
                <th>Status</th>
                <th>Yearly fee</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.name}</strong>
                    <p className="small muted">Business {b.status.toLowerCase()}</p>
                  </td>
                  <td>
                    {b.current
                      ? `${b.current.startsOn} → ${b.current.expiresOn}`
                      : 'Not configured'}
                    {b.next && <p className="small muted">Next term: {b.next.startsOn}</p>}
                  </td>
                  <td>{b.current?.status.replaceAll('_', ' ') || 'NO PLAN'}</td>
                  <td>{b.current ? money(b.current.annualFeePaise) : '—'}</td>
                  <td>
                    {b.current ? (
                      <>
                        {b.current.paymentStatus}
                        <p className="small muted">Due {money(b.current.duePaise)}</p>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        onClick={() => {
                          setSelected(b.id);
                          setForm(null);
                          setPayment(null);
                        }}
                      >
                        Manage
                      </button>
                      {b.current && (
                        <button disabled={busy} onClick={() => start('renew', b)}>
                          Renew yearly
                        </button>
                      )}
                      {b.current && remind(b, b.current) && (
                        <a
                          className="button"
                          href={remind(b, b.current)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          WhatsApp reminder
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <label className="subscription-picker">
        Manage business
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setForm(null);
            setPayment(null);
          }}
        >
          <option value="">Select a business</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {form && (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const annualFeePaise = rupeesToPaise(form.fee);
              await api(
                '/api/admin/subscriptions',
                form.action === 'edit' ? 'PATCH' : 'POST',
                form.action === 'edit'
                  ? { id: form.id, annualFeePaise, notes: form.notes }
                  : {
                      action: form.action,
                      businessId: form.businessId,
                      ...(form.action === 'create' ? { startsOn: form.startsOn } : {}),
                      annualFeePaise,
                      notes: form.notes,
                    },
              );
              setForm(null);
            }, 'Subscription saved.');
          }}
        >
          <h2>
            {form.action === 'edit'
              ? 'Edit yearly fee'
              : form.action === 'renew'
                ? 'Renew for one year'
                : 'Add a yearly term'}
          </h2>
          <p>{businesses.find((b) => b.id === form.businessId)?.name}</p>
          <div className="form-grid">
            {form.action === 'create' && (
              <label>
                Starts on (UTC)
                <input
                  type="date"
                  required
                  value={form.startsOn}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                />
              </label>
            )}
            <label>
              Annual fee (INR)
              <input
                required
                inputMode="decimal"
                pattern="[0-9]+(\.[0-9]{1,2})?"
                placeholder="e.g. 2999.00"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </label>
          </div>
          {form.action === 'create' && form.startsOn && (
            <p className="muted small">
              Valid through {annualExpiry(form.startsOn)} (inclusive). One calendar-year term.
            </p>
          )}
          {form.action === 'renew' && (
            <p className="muted small">
              Starts after the latest term, or today if the previous term has expired. Payment must
              be recorded separately.
            </p>
          )}
          <label>
            Internal notes
            <textarea
              maxLength={1000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy}>
              Save subscription
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {business && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2>{business.name} · Renewal history</h2>
          <p className="muted small">
            Dates are UTC calendar dates, expiry inclusive. Payments are manually recorded; this
            module does not charge customers, send invoices or auto-debit.
          </p>
          <p>
            Renewal WhatsApp: <strong>{business.renewalWhatsapp || 'Not configured'}</strong> ·{' '}
            <Link href="/admin/businesses">Edit in Businesses</Link>
          </p>
          <p className="muted small">
            WhatsApp buttons open a pre-filled chat. Review the number/message and press Send
            yourself. No automated message is sent.
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => start(business.periods.length ? 'renew' : 'create', business)}
            >
              {business.periods.length ? 'Renew yearly' : 'Add yearly subscription'}
            </button>
          </div>
          {!business.periods.length ? (
            <p>No yearly subscription configured. Existing review pages are unaffected.</p>
          ) : (
            business.periods.map((p) => (
              <article className="subscription-term" key={p.id}>
                <div className="row">
                  <div>
                    <h3>
                      {p.startsOn} → {p.expiresOn}
                    </h3>
                    <p>
                      {p.status.replaceAll('_', ' ')} · {p.paymentStatus}
                    </p>
                    <p>
                      Fee {money(p.annualFeePaise)} · Paid {money(p.paidPaise)} · Due{' '}
                      {money(p.duePaise)}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setForm({
                          action: 'edit',
                          businessId: business.id,
                          id: p.id,
                          startsOn: p.startsOn,
                          fee: String(p.annualFeePaise / 100),
                          notes: p.notes || '',
                        });
                        setPayment(null);
                      }}
                    >
                      Edit fee / notes
                    </button>
                    <button
                      disabled={busy || !p.duePaise}
                      onClick={() => {
                        setPayment({
                          subscriptionId: p.id,
                          amount: String(p.duePaise / 100),
                          paidOn: isoDay(new Date()),
                          method: 'UPI',
                          reference: '',
                        });
                        setForm(null);
                      }}
                    >
                      Record payment
                    </button>
                    {remind(business, p) && (
                      <a
                        className="button"
                        href={remind(business, p)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp renewal reminder
                      </a>
                    )}
                  </div>
                </div>
                {p.notes && <p className="muted small">{p.notes}</p>}
                {payment?.subscriptionId === p.id && (
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const { amount, ...rest } = payment;
                        await api('/api/admin/subscriptions/payments', 'POST', {
                          ...rest,
                          amountPaise: rupeesToPaise(amount),
                        });
                        setPayment(null);
                      }, 'Payment recorded.');
                    }}
                  >
                    <h3>Record manual payment</h3>
                    <div className="form-grid">
                      <label>
                        Amount received (INR)
                        <input
                          required
                          inputMode="decimal"
                          value={payment.amount}
                          onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                        />
                      </label>
                      <label>
                        Paid on (UTC)
                        <input
                          type="date"
                          required
                          max={isoDay(new Date())}
                          value={payment.paidOn}
                          onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })}
                        />
                      </label>
                      <label>
                        Payment method
                        <select
                          value={payment.method}
                          onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                        >
                          {['UPI', 'BANK_TRANSFER', 'CASH', 'OTHER'].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Payment reference (optional)
                        <input
                          maxLength={150}
                          value={payment.reference}
                          onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="actions">
                      <button className="primary" disabled={busy}>
                        Save payment
                      </button>
                      <button type="button" onClick={() => setPayment(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {p.payments.length > 0 && (
                  <div className="rows">
                    {p.payments.map((pay) => (
                      <div className="row" key={pay.id}>
                        <p className="small">
                          {pay.paidOn} · {money(pay.amountPaise)} · {pay.method}
                          {pay.reference ? ' · ' + pay.reference : ''}
                          {pay.voided ? ' · VOIDED' : ''}
                        </p>
                        {!pay.voided && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  'Void this incorrectly recorded payment? Its history is kept.',
                                )
                              )
                                void run(async () => {
                                  await api('/api/admin/subscriptions/payments', 'DELETE', {
                                    id: pay.id,
                                  });
                                }, 'Payment voided.');
                            }}
                          >
                            Void payment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      )}
    </>
  );
}
