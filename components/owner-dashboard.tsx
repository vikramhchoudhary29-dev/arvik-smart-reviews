'use client';
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/firebase-client';
import { readApiResponse } from '@/lib/api-response';
import type { AnalyticsSnapshot } from '@/lib/analytics-model';
import { AnalyticsWorkspace } from './analytics-workspace';
import { api } from './admin';

type Business = {
  id: string;
  name: string;
  category: string;
  status: string;
  logo: string;
  brandColor: string;
  welcomeMessage: string;
};
type Staff = { id: string; name: string; role: string; active: boolean; mentions: number };
type Stand = {
  id: string;
  label: string | null;
  code: string;
  location: string;
  active: boolean;
  lastActivity: string | null;
};
type Details = {
  business: Business;
  settings: { staffEnabled: boolean; staffQuestion: string };
  defaultQuestion: string;
  staff: Staff[];
  stands: Stand[];
  mentionRange: { from: string; to: string };
};
const sections = ['Overview', 'Analytics', 'My Stands', 'Reports', 'Staff', 'Branding'] as const;
type Section = (typeof sections)[number];
async function download(url: string, fallback: string) {
  const token = await clientAuth().currentUser?.getIdToken();
  if (!token) throw Error('Please sign in again.');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!r.ok) await readApiResponse(r);
  const objectUrl = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || fallback;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export default function OwnerDashboard() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]),
    [selected, setSelected] = useState(''),
    [section, setSection] = useState<Section>('Overview'),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    try {
      const unsubscribe = onAuthStateChanged(clientAuth(), async (user) => {
        setReady(false);
        setBusinesses([]);
        if (!user) {
          router.replace('/owner/login');
          return;
        }
        try {
          const data = await api<{ businesses: Business[] }>('/api/owner/me');
          if (!cancelled) {
            setBusinesses(data.businesses);
            setSelected(data.businesses[0]?.id || '');
            setReady(true);
            setError('');
          }
        } catch (e) {
          if (!cancelled) setError((e as Error).message);
        }
      });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    } catch {
      setError('Unable to initialise sign-in. Please contact Arvik support.');
    }
  }, [router]);
  return (
    <div className="admin-shell owner-shell">
      <aside className="sidebar">
        <p className="eyebrow">ARVIK SMART REVIEWS</p>
        <h2>Business workspace</h2>
        <nav aria-label="Owner navigation">
          {sections.map((name) => (
            <button
              key={name}
              aria-current={section === name ? 'page' : undefined}
              className={section === name ? 'active' : ''}
              onClick={() => setSection(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <button onClick={() => signOut(clientAuth()).then(() => router.replace('/owner/login'))}>
          Sign out
        </button>
      </aside>
      <main className="admin-main">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : !ready ? (
          <div className="skeleton" role="status">
            Verifying business access…
          </div>
        ) : !businesses.length ? (
          <section className="panel">
            <h1>No business assigned</h1>
            <p>
              Your account has no active business assignment. Contact Arvik Digital to restore
              access.
            </p>
          </section>
        ) : (
          <>
            <div className="owner-business-switch no-print">
              <label>
                Your business
                <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="muted small">
                Only data for this assigned business is available.
              </span>
            </div>
            {section === 'Overview' || section === 'Analytics' || section === 'Reports' ? (
              <OwnerAnalytics key={selected + section} businessId={selected} section={section} />
            ) : (
              <OwnerDetails key={selected + section} businessId={selected} section={section} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
function OwnerAnalytics({ businessId, section }: { businessId: string; section: Section }) {
  const loadSnapshot = useCallback(
    (query: URLSearchParams) => {
      const q = new URLSearchParams(query);
      q.set('businessId', businessId);
      return api<AnalyticsSnapshot>('/api/owner/analytics?' + q);
    },
    [businessId],
  );
  const exportReport = useCallback(
    async (query: URLSearchParams) => {
      const q = new URLSearchParams(query);
      q.set('businessId', businessId);
      await download('/api/owner/reports?' + q, 'business-report');
    },
    [businessId],
  );
  return (
    <AnalyticsWorkspace
      scopedBusinessId={businessId}
      dashboard={section === 'Overview'}
      loadSnapshot={loadSnapshot}
      exportReport={exportReport}
    />
  );
}
function OwnerDetails({ businessId, section }: { businessId: string; section: Section }) {
  const [data, setData] = useState<Details | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [preset, setPreset] = useState('last30'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [staffForm, setStaffForm] = useState({ id: '', name: '', role: '', active: true });
  const [settings, setSettings] = useState({ staffEnabled: false, staffQuestion: '' });
  const [branding, setBranding] = useState({ logo: '', brandColor: '#10b981', welcomeMessage: '' });
  const base = '/api/owner/business?businessId=' + encodeURIComponent(businessId);
  const load = useCallback(
    async (query = '') => {
      const next = await api<Details>(
        '/api/owner/business?businessId=' + encodeURIComponent(businessId) + query,
      );
      setData(next);
      setSettings(next.settings);
      setBranding({
        logo: next.business.logo,
        brandColor: next.business.brandColor,
        welcomeMessage: next.business.welcomeMessage,
      });
    },
    [businessId],
  );
  useEffect(() => {
    let cancelled = false;
    void api<Details>(base)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setSettings(next.settings);
        setBranding({
          logo: next.business.logo,
          brandColor: next.business.brandColor,
          welcomeMessage: next.business.welcomeMessage,
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [base]);
  const mentionQuery = () =>
    '&' + new URLSearchParams({ preset, ...(preset === 'custom' ? { from, to } : {}) });
  async function run(fn: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    await run(async () => {
      const token = await clientAuth().currentUser?.getIdToken();
      const form = new FormData();
      form.set('file', file);
      const r = await fetch('/api/owner/upload?businessId=' + encodeURIComponent(businessId), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      const j = await readApiResponse<{ url: string }>(r);
      setBranding((current) => ({ ...current, logo: j.url }));
    }, 'Logo uploaded. Save branding to apply it to your review page.');
  }
  return (
    <>
      <p className="eyebrow">YOUR BUSINESS WORKSPACE</p>
      <h1>{section}</h1>
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
      {!data ? (
        !error && <div className="skeleton">Loading business details…</div>
      ) : section === 'My Stands' ? (
        <>
          <p className="muted">
            Permanent NFC/QR links for {data.business.name}. Contact Arvik Digital for stand
            activation or assignment changes.
          </p>
          {!data.stands.length ? (
            <p className="panel">No stands assigned to this business yet.</p>
          ) : (
            <div className="rows">
              {data.stands.map((s) => (
                <article className="panel row" key={s.id}>
                  <div>
                    <h2>{s.label || 'NFC / QR Stand'}</h2>
                    <p>
                      {s.location || 'Location not set'} · {s.active ? 'Active' : 'Inactive'}
                    </p>
                    <p className="muted small">
                      Last interaction:{' '}
                      {s.lastActivity
                        ? new Date(s.lastActivity).toLocaleString()
                        : 'No activity recorded'}
                    </p>
                  </div>
                  <div className="actions">
                    <a
                      className="button"
                      href={'/r/' + encodeURIComponent(s.code)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Preview page
                    </a>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            download(
                              '/api/owner/stands/' +
                                encodeURIComponent(s.id) +
                                '/qr?businessId=' +
                                encodeURIComponent(businessId),
                              'stand-qr.png',
                            ),
                          'QR downloaded.',
                        )
                      }
                    >
                      Download QR
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : section === 'Staff' ? (
        <>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(base, 'PATCH', { kind: 'experience', values: settings });
                await load(mentionQuery());
              }, 'Staff question saved.');
            }}
          >
            <h2>Customer staff mentions</h2>
            <label>
              <input
                type="checkbox"
                checked={settings.staffEnabled}
                onChange={(e) => setSettings({ ...settings, staffEnabled: e.target.checked })}
              />
              Enable optional staff selection
            </label>
            <label>
              Question shown to customers
              <input
                maxLength={180}
                value={settings.staffQuestion}
                placeholder={data.defaultQuestion}
                onChange={(e) => setSettings({ ...settings, staffQuestion: e.target.value })}
              />
            </label>
            <p className="muted small">
              Leave blank for the category default. Customers may skip this question. Only active
              staff are shown.
            </p>
            <button className="primary" disabled={busy}>
              Save staff settings
            </button>
          </form>
          <form
            className="panel"
            style={{ marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/api/owner/staff?businessId=' + encodeURIComponent(businessId), 'POST', {
                  ...(staffForm.id ? { id: staffForm.id } : {}),
                  values: { name: staffForm.name, role: staffForm.role, active: staffForm.active },
                });
                setStaffForm({ id: '', name: '', role: '', active: true });
                await load(mentionQuery());
              }, 'Staff saved.');
            }}
          >
            <h2>{staffForm.id ? 'Edit staff member' : 'Add staff member'}</h2>
            <div className="form-grid">
              <label>
                Display name
                <input
                  required
                  maxLength={80}
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </label>
              <label>
                Role (optional)
                <input
                  maxLength={80}
                  placeholder="Waiter, stylist, sales advisor…"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                />
              </label>
            </div>
            <label>
              <input
                type="checkbox"
                checked={staffForm.active}
                onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })}
              />
              Active
            </label>
            <p className="muted small">
              Use a staff-approved display name. It will be visible publicly and may appear in
              customer drafts.
            </p>
            <div className="actions">
              <button className="primary" disabled={busy}>
                Save staff member
              </button>
              {staffForm.id && (
                <button
                  type="button"
                  onClick={() => setStaffForm({ id: '', name: '', role: '', active: true })}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => load(mentionQuery()), 'Mention date range applied.');
            }}
          >
            <label>
              Mention date range
              <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                <option value="today">Today</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="month">This month</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {preset === 'custom' && (
              <>
                <label>
                  From (UTC)
                  <input
                    type="date"
                    required
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To (UTC)
                  <input
                    type="date"
                    required
                    min={from}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </>
            )}
            <button disabled={busy}>Apply dates</button>
          </form>
          <p className="muted small">
            {data.mentionRange.from} to {data.mentionRange.to} UTC. Mentions count successful
            draft-generation requests with a selected staff member, including regenerations; not
            copies or published Google reviews.
          </p>
          {!data.staff.length ? (
            <p className="panel">No staff yet. Add a member and enable staff selection to start.</p>
          ) : (
            <div className="rows">
              {data.staff.map((s) => (
                <article key={s.id} className="panel row">
                  <div>
                    <strong>{s.name}</strong>
                    <p>
                      {s.role || 'Staff'} · {s.active ? 'Active' : 'Inactive'}
                    </p>
                    <p className="muted">{s.mentions} draft-generation mentions</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      setStaffForm({ id: s.id, name: s.name, role: s.role, active: s.active })
                    }
                  >
                    Edit staff
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(base, 'PATCH', { kind: 'branding', values: branding });
            }, 'Branding saved. Your review page is updated.');
          }}
        >
          <h2>Your review page, your brand</h2>
          <p className="muted">
            Business identity and Google Review destination remain managed by Arvik Digital.
          </p>
          {branding.logo && (
            <img src={branding.logo} className="logo" alt="Business logo preview" />
          )}
          <label>
            Upload logo (PNG, JPEG or WebP, up to 1 MB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          {branding.logo && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setBranding({ ...branding, logo: '' })}
            >
              Remove logo
            </button>
          )}
          <label>
            Brand colour
            <input
              type="color"
              value={branding.brandColor}
              onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
            />
          </label>
          <label>
            Welcome message
            <textarea
              maxLength={300}
              value={branding.welcomeMessage}
              onChange={(e) => setBranding({ ...branding, welcomeMessage: e.target.value })}
              placeholder="Tell us about your experience."
            />
          </label>
          <button className="primary" disabled={busy}>
            Save branding
          </button>
        </form>
      )}
    </>
  );
}
