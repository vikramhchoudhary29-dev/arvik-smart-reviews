'use client';
import { useEffect, useState } from 'react';
import { Shell, api } from './admin';
type Assignment = {
  id: string;
  email: string;
  businessId: string;
  active: boolean;
  business: { name: string };
};
export default function OwnerAdmin() {
  return (
    <Shell section="owners">
      <OwnerManager />
    </Shell>
  );
}
function OwnerManager() {
  const [owners, setOwners] = useState<Assignment[]>([]),
    [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]),
    [email, setEmail] = useState(''),
    [businessId, setBusinessId] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [setupLink, setSetupLink] = useState('');
  async function load() {
    try {
      const [a, b] = await Promise.all([
        api<{ owners: Assignment[] }>('/api/admin/owners'),
        api<{ businesses: { id: string; name: string }[] }>('/api/admin/businesses'),
      ]);
      setOwners(a.owners);
      setBusinesses(b.businesses);
      setBusinessId((current) => current || b.businesses[0]?.id || '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    setSetupLink('');
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">ACCESS MANAGEMENT</p>
      <h1>Business Owners</h1>
      <p className="muted">
        Grant access to a specific business. One Firebase account can manage multiple assigned
        businesses. Owner accounts never receive Super Admin permissions.
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
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void action(
            () => api('/api/admin/owners', 'POST', { email, businessId }),
            'Access granted. Generate a setup link if the owner needs to set a password.',
          );
        }}
      >
        <h2>Assign an owner</h2>
        <div className="form-grid">
          <label>
            Owner email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Business
            <select required value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              <option value="" disabled>
                Select business
              </option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy || !businessId}>
          Grant access
        </button>
      </form>
      {setupLink && (
        <div className="panel" role="status">
          <h2>Private password setup link</h2>
          <p>
            Share this short-lived link privately with the intended owner. It resets the account
            password. Email verification is still required at first sign-in.
          </p>
          <label>
            Setup link
            <textarea readOnly value={setupLink} onFocus={(e) => e.target.select()} />
          </label>
          <button onClick={() => setSetupLink('')}>Hide link</button>
        </div>
      )}
      {loading ? (
        <div className="skeleton">Loading owner assignments…</div>
      ) : !owners.length ? (
        <p className="panel">No owner accounts assigned yet.</p>
      ) : (
        <div className="rows" style={{ marginTop: 20 }}>
          {owners.map((o) => (
            <article key={o.id} className="panel row">
              <div>
                <strong>{o.email}</strong>
                <p className="muted">
                  {o.business.name} · {o.active ? 'Active' : 'Revoked'}
                </p>
              </div>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () => api('/api/admin/owners', 'PATCH', { id: o.id, active: !o.active }),
                      'Assignment updated.',
                    )
                  }
                >
                  {o.active ? 'Revoke access' : 'Restore access'}
                </button>
                {o.active && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const r = await api<{ setupLink: string }>(
                          '/api/admin/owners/invite',
                          'POST',
                          { id: o.id },
                        );
                        setSetupLink(r.setupLink);
                      }, 'Setup link ready. No email was sent automatically.')
                    }
                  >
                    Generate setup link
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
