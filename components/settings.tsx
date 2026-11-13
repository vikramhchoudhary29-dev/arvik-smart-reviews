'use client';
import { useEffect, useState } from 'react';
import { api, Shell } from './admin';
export function SettingsPage() {
  return (
    <Shell section="settings">
      <Settings />
    </Shell>
  );
}
function Settings() {
  const [form, setForm] = useState({ supportEmail: '', retentionDays: 90 }),
    [base, setBase] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    api('/api/admin/settings')
      .then((j) => {
        setForm({ supportEmail: j.settings.supportEmail, retentionDays: j.settings.retentionDays });
        setBase(j.publicBaseUrl);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <h1>Settings</h1>
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
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('/api/admin/settings', 'PATCH', form);
            setNotice('Settings saved.');
            setError('');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Support email
          <input
            type="email"
            value={form.supportEmail}
            onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
          />
        </label>
        <label>
          Anonymous analytics retention (days, 7–365)
          <input
            type="number"
            min={7}
            max={365}
            value={form.retentionDays}
            onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })}
          />
        </label>
        <button className="primary">Save settings</button>
        <p className="muted">Retention is applied by the documented scheduled cleanup command.</p>
      </form>
      <section className="panel" style={{ marginTop: 24 }}>
        <h2>Platform configuration</h2>
        <p>Public stand base URL: {base || 'Not configured — set NEXT_PUBLIC_APP_URL'}</p>
        <p className="muted">
          Domain, Firebase credentials, administrator email allowlist and rate-limit secret are
          configured through server environment variables. Never enter credentials into public
          forms.
        </p>
        <p>Arvik Digital · One-time commercial service · No review incentives</p>
      </section>
    </>
  );
}
