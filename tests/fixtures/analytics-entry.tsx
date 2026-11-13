import React from 'react';
import { readApiResponse } from '../../lib/api-response';
import { createRoot } from 'react-dom/client';
import { AnalyticsWorkspace } from '../../components/analytics-workspace';
const load = async (q: URLSearchParams) => {
  const r = await fetch('/snapshot?' + q);
  return readApiResponse<import('../../lib/analytics-model').AnalyticsSnapshot>(r);
};
const download = async (q: URLSearchParams) => {
  const r = await fetch('/export?' + q);
  if (!r.ok) throw Error('Export failed');
  const a = document.createElement('a');
  const url = URL.createObjectURL(await r.blob());
  a.href = url;
  a.download = 'report.' + q.get('format');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
createRoot(document.getElementById('root')!).render(
  <div className="admin-shell">
    <aside className="sidebar">
      <p className="eyebrow">ARVIK DIGITAL</p>
      <h2>Smart Reviews</h2>
      <nav>
        {[
          ['Dashboard', 'dashboard'],
          ['Reports', 'reports'],
        ].map(([title, path]) => (
          <a
            key={path}
            className={location.pathname.includes(path) ? 'active' : ''}
            href={'/' + path}
          >
            {title}
          </a>
        ))}
      </nav>
      <p className="muted small">Isolated test fixture</p>
    </aside>
    <main className="admin-main">
      <AnalyticsWorkspace
        dashboard={location.pathname.includes('dashboard')}
        loadSnapshot={load}
        exportReport={download}
      />
    </main>
  </div>,
);
