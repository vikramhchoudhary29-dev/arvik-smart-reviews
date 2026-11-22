'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, Shell } from './admin';
import { categories } from '@/lib/categories';
type Outlet = { id: string; name: string; category: string; active: boolean };
type Assignment = {
  id: string;
  name?: string;
  label?: string | null;
  code?: string;
  outletId: string | null;
};
type Data = {
  outlets: Outlet[];
  staff: Assignment[];
  stands: Assignment[];
  activity: { outletId: string | null; type: string; _count: number }[];
  filters: { from: string; to: string };
};
const initial = { name: '', category: 'restaurant', active: true };
export function OutletManager({
  businessId,
  admin = false,
}: {
  businessId: string;
  admin?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(initial),
    [id, setId] = useState(''),
    [preset, setPreset] = useState('last30');
  const url = `/api/${admin ? 'admin' : 'owner'}/outlets?businessId=${encodeURIComponent(businessId)}&preset=${preset}`;
  const load = useCallback(async () => {
    const next = await api<Data>(url);
    setData(next);
  }, [url]);
  useEffect(() => {
    let current = true;
    setData(null);
    setError('');
    api<Data>(url)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [url]);
  async function save(body: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(url, 'POST', body);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Outlets</h1>
      <p>
        One business, one Google Review link. Customers choose an outlet for relevant experience
        options and staff. Deactivate an outlet to hide it while preserving its history.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save({ action: 'save', ...(id ? { id } : {}), values: form })) {
            setForm(initial);
            setId('');
          }
        }}
      >
        <h2>{id ? 'Edit outlet' : 'Add outlet'}</h2>
        <label>
          Outlet name
          <input
            required
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {Object.keys(categories).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />{' '}
          Active
        </label>
        <button className="primary" disabled={busy}>
          Save outlet
        </button>
        {id && (
          <button
            type="button"
            onClick={() => {
              setForm(initial);
              setId('');
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {!data ? (
        <p role="status">Loading outlets…</p>
      ) : (
        <>
          <section className="panel">
            <h2>Outlet activity</h2>
            <label>
              Date range (UTC)
              <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                <option value="today">Today</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="month">This month</option>
              </select>
            </label>
            <p>
              {data.filters.from} to {data.filters.to}. Counts are recorded interactions, not unique
              customers or published reviews. Visits before an outlet is selected stay under
              General.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Outlet</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Visits</th>
                    <th>Generations</th>
                    <th>Copies</th>
                    <th>Google clicks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      id: '',
                      name: 'General / historical unassigned',
                      category: '—',
                      active: true,
                    },
                    ...data.outlets,
                  ].map((o) => {
                    const count = (...types: string[]) =>
                      data.activity
                        .filter((a) => (a.outletId || '') === o.id && types.includes(a.type))
                        .reduce((n, a) => n + a._count, 0);
                    return (
                      <tr key={o.id}>
                        <td>{o.name}</td>
                        <td>{o.category}</td>
                        <td>{o.active ? 'Active' : 'Inactive'}</td>
                        <td>{count('PAGE_VIEW')}</td>
                        <td>{count('SUGGESTION_GENERATE', 'SUGGESTION_REGENERATE')}</td>
                        <td>{count('COPY_SUGGESTION')}</td>
                        <td>{count('GOOGLE_LINK_CLICK')}</td>
                        <td>
                          {o.id && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                setId(o.id);
                                setForm({ name: o.name, category: o.category, active: o.active });
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!data.outlets.length && (
              <p>No outlets yet. Existing review pages continue using the business category.</p>
            )}
          </section>
          {(['staff', 'stands'] as const).map((kind) => (
            <section className="panel" key={kind}>
              <h2>{kind === 'staff' ? 'Assign staff to outlets' : 'Stand default outlet'}</h2>
              <p>
                {kind === 'staff'
                  ? 'General staff appear for the general business experience. Enable staff selection in Staff settings.'
                  : 'A counter stand preselects its outlet. Customers can change it. Codes and printed QR links stay the same.'}
              </p>
              {!data[kind].length && <p>No {kind} available.</p>}
              {data[kind].map((item) => (
                <label key={item.id}>
                  {item.name || item.label || item.code}
                  <select
                    disabled={busy}
                    value={item.outletId || ''}
                    onChange={(e) =>
                      void save({
                        action: kind === 'staff' ? 'staff' : 'stand',
                        [kind === 'staff' ? 'staffId' : 'standId']: item.id,
                        outletId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">General / no default</option>
                    {data.outlets
                      .filter((o) => o.active || o.id === item.outletId)
                      .map((o) => (
                        <option key={o.id} value={o.id} disabled={!o.active}>
                          {o.name}
                          {!o.active ? ' (inactive)' : ''}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
function AdminOutletContent() {
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<{ businesses: { id: string; name: string }[] }>('/api/admin/businesses')
      .then((d) => {
        if (active) {
          setBusinesses(d.businesses);
          setSelected(d.businesses[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {error && <p className="error">{error}</p>}
      <label>
        Business
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <OutletManager key={selected} businessId={selected} admin />
      ) : (
        <p>Select or create a business to manage outlets.</p>
      )}
    </>
  );
}

export default function AdminOutlets() {
  return (
    <Shell section="outlets">
      <AdminOutletContent />
    </Shell>
  );
}
