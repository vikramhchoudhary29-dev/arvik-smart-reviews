'use client';
import { readApiResponse } from '@/lib/api-response';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/firebase-client';
import { categories } from '@/lib/categories';
type Row = Record<string, any>;
export async function api<T = Record<string, any>>(url: string, method = 'GET', data?: unknown) {
  const token = await clientAuth().currentUser?.getIdToken();
  if (!token) throw Error('Please sign in.');
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  });
  const j = await readApiResponse<T>(r);
  return j;
}
export function Shell({ section, children }: { section: string; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    try {
      return onAuthStateChanged(clientAuth(), async (u) => {
        if (!u) {
          router.replace('/admin/login');
          return;
        }
        try {
          await api('/api/admin/settings');
          setReady(true);
        } catch (e) {
          setError((e as Error).message);
        }
      });
    } catch (e) {
      setError('Configure Firebase web environment variables before signing in.');
    }
  }, [router]);
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <p className="eyebrow">ARVIK DIGITAL</p>
        <h2>Smart Reviews</h2>
        <nav>
          {[
            ['Dashboard', ''],
            ['Businesses', 'businesses'],
            ['NFC Stands', 'stands'],
            ['Review Templates', 'templates'],
            ['Analytics', 'analytics'],
            ['Reports', 'reports'],
            ['Business Owners', 'owners'],
            ['Settings', 'settings'],
          ].map(([name, key]) => (
            <Link
              key={key}
              className={section === key ? 'active' : ''}
              href={'/admin' + (key ? '/' + key : '')}
            >
              {name}
            </Link>
          ))}
        </nav>
        <button onClick={() => signOut(clientAuth()).then(() => router.replace('/admin/login'))}>
          Sign out
        </button>
      </aside>
      <main className="admin-main">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : ready ? (
          children
        ) : (
          <div className="skeleton">Verifying administrator access…</div>
        )}
      </main>
    </div>
  );
}
const businessFields = [
  'name',
  'slug',
  'category',
  'contactName',
  'phone',
  'whatsapp',
  'email',
  'address',
  'city',
  'state',
  'pincode',
  'googleMapsUrl',
  'googleReviewUrl',
  'description',
  'welcomeMessage',
  'internalNotes',
  'brandColor',
  'status',
];
const label = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export function Manager({ kind }: { kind: 'businesses' | 'stands' | 'templates' }) {
  const [rows, setRows] = useState<Row[]>([]),
    [businesses, setBusinesses] = useState<Row[]>([]),
    [form, setForm] = useState<Row | null>(null),
    [edit, setEdit] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [qr, setQr] = useState<Row | null>(null),
    [qrImage, setQrImage] = useState('');
  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/' + kind);
      setRows(data[kind]);
      if (kind === 'stands') setBusinesses((await api('/api/admin/businesses')).businesses);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void load();
    if (kind === 'stands')
      setQuery(new URLSearchParams(window.location.search).get('businessId') || '');
  }, [load, kind]);
  useEffect(
    () => () => {
      if (qrImage) URL.revokeObjectURL(qrImage);
    },
    [qrImage],
  );
  const defaults = () =>
    kind === 'businesses'
      ? {
          name: '',
          slug: '',
          category: 'general',
          googleReviewUrl: '',
          status: 'INACTIVE',
          brandColor: '#10b981',
          logo: '',
          coverImage: '',
          linkTested: false,
        }
      : kind === 'stands'
        ? {
            businessId: businesses[0]?.id || '',
            label: '',
            type: 'NFC_QR',
            location: '',
            active: true,
          }
        : {
            category: 'general',
            tag: '*',
            sentiment: 'neutral',
            text: 'The {aspect} was okay.',
            active: true,
          };
  const fields =
    kind === 'businesses'
      ? businessFields
      : kind === 'stands'
        ? ['businessId', 'label', 'type', 'location', 'active']
        : ['category', 'tag', 'sentiment', 'text', 'active'];
  function start(row?: Row) {
    setEdit(row?.id || '');
    const next: Row = defaults();
    if (row) for (const k of [...fields, 'logo', 'coverImage']) if (k in row) next[k] = row[k];
    setForm(next);
    setError('');
    setNotice('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/' + kind + (edit ? '/' + edit : ''), edit ? 'PATCH' : 'POST', form);
      setForm(null);
      setNotice('Saved successfully.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(row: Row) {
    const active = kind === 'businesses' ? row.status === 'ACTIVE' : row.active;
    if (
      !window.confirm(
        (active ? 'Deactivate ' : 'Activate ') + (row.name || row.label || 'template') + '?',
      )
    )
      return;
    setBusy(true);
    try {
      await api(
        '/api/admin/' + kind + '/' + row.id,
        'PATCH',
        kind === 'businesses' ? { status: active ? 'INACTIVE' : 'ACTIVE' } : { active: !active },
      );
      await load();
      setNotice('Status updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: Row) {
    if (
      !window.confirm(
        'Permanently delete this ' +
          (kind === 'businesses' ? 'business if it has no history' : 'template') +
          '?',
      )
    )
      return;
    try {
      await api('/api/admin/' + kind + '/' + row.id, 'DELETE');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload(file: File | undefined, key: string) {
    if (!file || !form) return;
    setBusy(true);
    try {
      const token = await clientAuth().currentUser?.getIdToken();
      const body = new FormData();
      body.set('file', file);
      const r = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body,
      });
      const j = await readApiResponse(r);
      setForm((v) => ({ ...v, [key]: j.url }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(row: Row, format: string, preview = false) {
    try {
      const token = await clientAuth().currentUser?.getIdToken();
      const r = await fetch('/api/admin/stands/' + row.id + '/qr?format=' + format, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw Error('Could not generate QR code. Check the app URL configuration.');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (preview) {
        setQr(row);
        setQrImage(url);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stand-' + row.code + '.' + format;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const shown = rows.filter(
    (r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' ||
        (kind === 'businesses' ? r.status === 'ACTIVE' : r.active) === (filter === 'active')),
  );
  const paged = shown.slice(page * 10, page * 10 + 10);
  return (
    <>
      <div className="row no-print">
        <div>
          <p className="eyebrow">CENTRAL OPERATIONS</p>
          <h1>
            {kind === 'stands'
              ? 'NFC & QR stands'
              : kind === 'templates'
                ? 'Review templates'
                : 'Businesses'}
          </h1>
        </div>
        <button className="primary" onClick={() => start()}>
          + Add {kind === 'businesses' ? 'business' : kind === 'stands' ? 'stand' : 'template'}
        </button>
      </div>
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
      {form && (
        <form onSubmit={save} className="panel no-print">
          <h2>
            {edit ? 'Edit' : 'Create'}{' '}
            {kind === 'businesses' ? 'business' : kind === 'stands' ? 'stand' : 'template'}
          </h2>
          <div className="form-grid">
            {fields.map((key) => {
              let options: string[] | undefined;
              if (key === 'category') options = Object.keys(categories);
              if (key === 'tag') options = ['*', ...(categories[form.category] || [])];
              if (key === 'status') options = ['INACTIVE', 'ACTIVE'];
              if (key === 'type') options = ['NFC_QR', 'NFC', 'QR'];
              if (key === 'sentiment') options = ['positive', 'neutral', 'critical'];
              return (
                <label key={key}>
                  {label(key)}
                  {key === 'businessId' ? (
                    <select
                      required
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : key === 'active' ? (
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                  ) : options ? (
                    <select
                      value={form[key] || ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    >
                      {options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : ['description', 'welcomeMessage', 'internalNotes', 'text'].includes(key) ? (
                    <textarea
                      rows={3}
                      maxLength={key === 'text' ? 500 : 2000}
                      required={key === 'text'}
                      value={form[key] || ''}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={
                        key === 'brandColor'
                          ? 'color'
                          : key === 'email'
                            ? 'email'
                            : key.endsWith('Url')
                              ? 'url'
                              : 'text'
                      }
                      required={['name', 'slug', 'googleReviewUrl', 'tag'].includes(key)}
                      maxLength={
                        key === 'name'
                          ? 150
                          : key === 'slug' || key === 'tag' || key === 'label'
                            ? 80
                            : 2048
                      }
                      value={form[key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]: e.target.value,
                          ...(key === 'googleReviewUrl' ? { linkTested: false } : {}),
                        })
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
          {kind === 'businesses' && (
            <>
              <div className="form-grid">
                {['logo', 'coverImage'].map((key) => (
                  <div
                    key={key}
                    className="drop"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void upload(e.dataTransfer.files[0], key);
                    }}
                  >
                    <label>
                      {label(key)} — drop image or choose file
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => upload(e.target.files?.[0], key)}
                      />
                    </label>
                    {form[key] && (
                      <>
                        <img
                          src={form[key]}
                          alt={label(key)}
                          style={{ height: 80, maxWidth: 180, objectFit: 'contain' }}
                        />
                        <button type="button" onClick={() => setForm({ ...form, [key]: '' })}>
                          Remove image
                        </button>
                      </>
                    )}
                    <p className="muted small">PNG, JPEG or WebP · maximum 1 MB</p>
                  </div>
                ))}
              </div>
              <div className="panel">
                <a
                  href={form.googleReviewUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Test Google Review link ↗
                </a>
                <label>
                  <input
                    type="checkbox"
                    checked={!!form.linkTested}
                    onChange={(e) => setForm({ ...form, linkTested: e.target.checked })}
                  />
                  I opened this exact URL and confirmed the correct business review destination.
                </label>
                <p className="muted small">
                  Existing tested links remain confirmed unless the destination changes. An active
                  business needs a tested destination.
                </p>
              </div>
            </>
          )}
          {kind === 'templates' && (
            <p className="notice">
              Preview:{' '}
              {(form.text || '').replaceAll(
                '{aspect}',
                form.tag === '*' ? 'service' : form.tag.toLowerCase(),
              )}
            </p>
          )}
          <div className="toolbar">
            <button disabled={busy} className="primary">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {qr && (
        <section className="panel print-qr">
          <h1>{qr.business?.name}</h1>
          <h2>Share your genuine experience</h2>
          <img src={qrImage} alt="Stand QR code" />
          <p>Scan the QR code or tap the NFC stand.</p>
          <p>Positive, neutral and critical feedback welcome.</p>
          <p className="small">Stand: {qr.label || qr.code}</p>
          <div className="actions no-print">
            <button onClick={() => window.print()}>Print stand layout</button>
            <button
              onClick={() => {
                setQr(null);
                setQrImage('');
              }}
            >
              Close preview
            </button>
          </div>
        </section>
      )}
      <div className="toolbar no-print">
        <input
          aria-label="Search"
          placeholder="Search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Status filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="muted">{shown.length} records</span>
      </div>
      {loading ? (
        <div className="skeleton">Loading records…</div>
      ) : (
        <div className="rows no-print">
          {paged.length === 0 ? (
            <div className="panel muted">
              No records match. Add a record or change your filters.
            </div>
          ) : (
            paged.map((row) => (
              <article key={row.id} className="panel">
                <div className="row">
                  <div>
                    <h2>{row.name || row.label || row.text}</h2>
                    <p className="muted small">
                      {kind === 'businesses'
                        ? row.category + ' · ' + row.city + ' · ' + row._count.stands + ' stands'
                        : kind === 'stands'
                          ? row.business?.name + ' · ' + row.type + ' · ' + row.location
                          : row.category + ' · ' + row.sentiment + ' · ' + row.tag}
                    </p>
                    <p className="muted small">
                      Created {new Date(row.createdAt).toLocaleDateString()}
                      {row.updatedAt
                        ? ' · Updated ' + new Date(row.updatedAt).toLocaleDateString()
                        : ''}
                    </p>
                    <p className="small">
                      {(kind === 'businesses' ? row.status === 'ACTIVE' : row.active)
                        ? '● Active'
                        : '○ Inactive'}
                    </p>
                  </div>
                  <div className="actions">
                    <button onClick={() => start(row)}>Edit / View</button>
                    <button disabled={busy} onClick={() => toggle(row)}>
                      {(kind === 'businesses' ? row.status === 'ACTIVE' : row.active)
                        ? 'Deactivate'
                        : 'Activate'}
                    </button>
                    {kind !== 'stands' && <button onClick={() => remove(row)}>Delete</button>}
                    {kind === 'businesses' && (
                      <Link className="button" href={'/admin/stands?businessId=' + row.id}>
                        Assigned stands
                      </Link>
                    )}
                    {kind !== 'templates' && (
                      <Link
                        className="button"
                        href={
                          '/admin/analytics?' +
                          (kind === 'businesses'
                            ? 'businessId='
                            : kind === 'stands'
                              ? 'standId='
                              : 'category=') +
                          row.id
                        }
                      >
                        Analytics
                      </Link>
                    )}
                  </div>
                </div>
                {kind === 'stands' && (
                  <>
                    <p className="muted small">
                      Last activity:{' '}
                      {row.lastActivity ? new Date(row.lastActivity).toLocaleString() : 'None'} ·
                      Permanent code: {row.code}
                    </p>
                    <div className="actions">
                      <a
                        className="button"
                        href={'/r/' + row.code}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open public page
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            const s = await api('/api/admin/settings');
                            await navigator.clipboard.writeText(
                              (s.publicBaseUrl || window.location.origin) + '/r/' + row.code,
                            );
                            setNotice('Stand URL copied.');
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Copy URL
                      </button>
                      <button onClick={() => download(row, 'png')}>PNG</button>
                      <button onClick={() => download(row, 'svg')}>SVG</button>
                      <button onClick={() => download(row, 'png', true)}>Print layout</button>
                    </div>
                  </>
                )}
              </article>
            ))
          )}
        </div>
      )}
      <div className="toolbar no-print">
        <button disabled={!page} onClick={() => setPage((v) => v - 1)}>
          Previous
        </button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(shown.length / 10))}
        </span>
        <button disabled={(page + 1) * 10 >= shown.length} onClick={() => setPage((v) => v + 1)}>
          Next
        </button>
      </div>
      {kind === 'stands' && (
        <section className="panel no-print">
          <h2>Writing an NTAG213 NFC tag</h2>
          <p>
            Use a compatible NFC-enabled phone and an NFC writing app. Choose a URL record, paste
            the permanent stand HTTPS URL, and write it to an NTAG213 tag. Read it back and test on
            Android and iPhone before attaching it. Check the QR scan opens the same URL. Do not
            lock the tag until verified; this application does not program hardware.
          </p>
        </section>
      )}
    </>
  );
}
export function ResourcePage({ kind }: { kind: 'businesses' | 'stands' | 'templates' }) {
  return (
    <Shell section={kind}>
      <Manager kind={kind} />
    </Shell>
  );
}
