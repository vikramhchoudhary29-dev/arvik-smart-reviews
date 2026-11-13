'use client';
import { useEffect, useRef, useState } from 'react';
import {
  eventNames,
  formatPercent,
  reportKinds,
  reportTitles,
  reportTable,
  selectReportRows,
  type AnalyticsSnapshot,
  type ReportKind,
  type Cell,
} from '@/lib/analytics-model';
import { TrendChart, FunnelChart, Ranking, Distribution } from './analytics-charts';
type Props = {
  dashboard?: boolean;
  loadSnapshot: (query: URLSearchParams) => Promise<AnalyticsSnapshot>;
  exportReport: (query: URLSearchParams) => Promise<void>;
};
type FilterDraft = {
  preset: string;
  from: string;
  to: string;
  businessId: string;
  standId: string;
  interval: string;
};
const initial: FilterDraft = {
  preset: 'last30',
  from: '',
  to: '',
  businessId: '',
  standId: '',
  interval: 'daily',
};
const integer = (n: number) => n.toLocaleString('en-US');
function MetricIcon({
  kind,
}: {
  kind: 'business' | 'stand' | 'visit' | 'generate' | 'copy' | 'click' | 'rate';
}) {
  const paths = {
    business: 'M3 21h18M5 21V5h14v16M9 9h1m4 0h1M9 13h1m4 0h1M10 21v-4h4v4',
    stand: 'M7 3h10v18H7zM10 6h4M11 18h2',
    visit: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    generate: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
    copy: 'M9 9h12v12H9zM15 5V3H3v12h2',
    click: 'm4 3 7 17 3-7 7-3z',
    rate: 'M4 19 19 4M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function Skeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="analytics-skeleton">
      <div className="skeleton-kpis">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} />
        ))}
      </div>
      <div className="skeleton-chart" />
    </div>
  );
}
function DataTable({
  data,
  kind,
  search,
  sort,
  direction,
  onSearch,
  onSort,
  onDirection,
}: {
  data: AnalyticsSnapshot;
  kind: ReportKind;
  search: string;
  sort: string;
  direction: 'asc' | 'desc';
  onSearch: (s: string) => void;
  onSort: (s: string) => void;
  onDirection: (s: 'asc' | 'desc') => void;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [kind, search, sort, direction, data]);
  const table = reportTable(data, kind),
    rows = selectReportRows(table, search, sort, direction),
    pages = Math.max(1, Math.ceil(rows.length / 15));
  const cell = (value: Cell, percentage?: boolean) =>
    percentage
      ? formatPercent(value as number | null)
      : value === null
        ? '—'
        : typeof value === 'number'
          ? integer(value)
          : value;
  return (
    <section className="insight-card report-data">
      <div className="section-heading">
        <div>
          <h2>{table.title}</h2>
          <p>
            {rows.length} matching {rows.length === 1 ? 'row' : 'rows'} · all matching rows included
            in exports
          </p>
        </div>
      </div>
      <div className="report-table-tools no-print">
        <label>
          Search report
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            maxLength={200}
            placeholder="Search names, status or values…"
          />
        </label>
        <label>
          Sort by
          <select
            value={table.columns.some((c) => c.key === sort) ? sort : table.columns[0].key}
            onChange={(e) => onSort(e.target.value)}
          >
            {table.columns.map((c) => (
              <option value={c.key} key={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order
          <select value={direction} onChange={(e) => onDirection(e.target.value as 'asc' | 'desc')}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 15, page * 15 + 15).map((row, i) => (
              <tr key={i}>
                {table.columns.map((c) => (
                  <td key={c.key}>
                    {c.key === 'status' ? (
                      <span
                        className={'status-pill ' + (row[c.key] === 'ACTIVE' ? 'is-active' : '')}
                      >
                        {cell(row[c.key], c.percentage)}
                      </span>
                    ) : (
                      cell(row[c.key], c.percentage)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="chart-empty compact">
            No matching rows. Change the search or selected filters.
          </div>
        )}
      </div>
      <div className="table-pagination no-print">
        <span>
          Page {Math.min(page + 1, pages)} of {pages}
        </span>
        <div>
          <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
export function AnalyticsWorkspace({ dashboard = false, loadSnapshot, exportReport }: Props) {
  const [draft, setDraft] = useState<FilterDraft>(initial),
    [data, setData] = useState<AnalyticsSnapshot | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [kind, setKind] = useState<ReportKind>('overview'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('metric'),
    [direction, setDirection] = useState<'asc' | 'desc'>('asc'),
    [exporting, setExporting] = useState(''),
    [notice, setNotice] = useState('');
  const sequence = useRef(0);
  const queryFor = (f: FilterDraft) => {
    const q = new URLSearchParams({ preset: f.preset, interval: f.interval });
    if (f.preset === 'custom') {
      q.set('from', f.from);
      q.set('to', f.to);
    }
    if (f.businessId) q.set('businessId', f.businessId);
    if (f.standId) q.set('standId', f.standId);
    return q;
  };
  async function load(f: FilterDraft) {
    const current = ++sequence.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await loadSnapshot(queryFor(f));
      if (sequence.current !== current) return;
      setData(next);
      setDraft({ ...f, from: next.filters.from, to: next.filters.to });
    } catch (e) {
      if (sequence.current === current) setError((e as Error).message);
    } finally {
      if (sequence.current === current) setBusy(false);
    }
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const f = {
      ...initial,
      businessId: q.get('businessId') || '',
      standId: q.get('standId') || '',
    };
    setDraft(f);
    void load(f);
    return () => {
      sequence.current++;
    };
  }, [loadSnapshot]);
  const filtersChanged =
    !!data &&
    (draft.preset !== data.filters.preset ||
      draft.businessId !== data.filters.businessId ||
      draft.standId !== data.filters.standId ||
      draft.interval !== data.filters.interval ||
      (draft.preset === 'custom' &&
        (draft.from !== data.filters.from || draft.to !== data.filters.to)));
  function chooseReport(next: ReportKind) {
    setKind(next);
    setSearch('');
    setSort(
      next === 'daily'
        ? 'period'
        : next === 'overview'
          ? 'metric'
          : next === 'funnel'
            ? 'count'
            : 'clicks',
    );
    setDirection(next === 'daily' || next === 'overview' ? 'asc' : 'desc');
  }
  async function download(format: string) {
    if (!data) return;
    setExporting(format);
    setError('');
    try {
      const q = queryFor(data.filters);
      q.set('report', kind);
      q.set('format', format);
      q.set('search', search);
      q.set('sort', sort);
      q.set('direction', direction);
      await exportReport(q);
      setNotice(
        format.toUpperCase() +
          ' report downloaded. Export was regenerated from the database using the applied filters.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting('');
    }
  }
  const name = (id: string, type: 'businesses' | 'stands') =>
    data?.options[type].find((x) => x.id === id)?.name || id;
  const applied = data
    ? data.filters.from +
      ' → ' +
      data.filters.to +
      ' UTC · ' +
      (data.filters.businessId ? name(data.filters.businessId, 'businesses') : 'All businesses') +
      ' · ' +
      (data.filters.standId ? name(data.filters.standId, 'stands') : 'All stands')
    : '';
  const printTable = data ? reportTable(data, kind) : null;
  const printRows = printTable ? selectReportRows(printTable, search, sort, direction) : [];
  return (
    <div className="analytics-workspace">
      <div className="analytics-screen no-print">
        <header className="analytics-header">
          <div>
            <p className="eyebrow">ARVIK DIGITAL / INTELLIGENCE</p>
            <h1>{dashboard ? 'Your platform, at a glance.' : 'Reports & insights'}</h1>
            <p className="muted">
              A clear view of genuine review interactions across your businesses.
            </p>
          </div>
          <div className="analytics-header-badge">
            <span className="live-dot" />
            Database-backed analytics
          </div>
        </header>
        <form
          className="analytics-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load(draft);
          }}
        >
          <label>
            Date range
            <select
              value={draft.preset}
              onChange={(e) => setDraft({ ...draft, preset: e.target.value })}
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </label>
          {draft.preset === 'custom' && (
            <>
              <label>
                From (UTC)
                <input
                  type="date"
                  required
                  value={draft.from}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                />
              </label>
              <label>
                To (UTC)
                <input
                  type="date"
                  required
                  min={draft.from}
                  value={draft.to}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                />
              </label>
            </>
          )}
          <label>
            Business
            <select
              value={draft.businessId}
              onChange={(e) => setDraft({ ...draft, businessId: e.target.value, standId: '' })}
            >
              <option value="">All businesses</option>
              {data?.options.businesses.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stand
            <select
              value={draft.standId}
              onChange={(e) => setDraft({ ...draft, standId: e.target.value })}
            >
              <option value="">All stands</option>
              {data?.options.stands.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                  {draft.businessId && s.businessId !== draft.businessId
                    ? ' (other current assignment)'
                    : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trend interval
            <select
              value={draft.interval}
              onChange={(e) => setDraft({ ...draft, interval: e.target.value })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Loading…' : 'Apply filters'}
          </button>
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
            <button type="button" onClick={() => void load(draft)}>
              Retry
            </button>
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {busy ? (
          <Skeleton />
        ) : (
          data && (
            <>
              <div className="applied-filter-line">
                <span>{applied}</span>
                <small>
                  Generated{' '}
                  {new Date(data.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                </small>
              </div>
              {filtersChanged && (
                <p className="pending-filters" role="status">
                  Filters changed. Apply them to refresh the data. Exports use the last applied
                  filters shown above.
                </p>
              )}
              {dashboard ? (
                <>
                  <div className="metric-section-label">
                    <h2>Platform inventory</h2>
                    <span>
                      All-time current records · platform-wide · unaffected by activity filters
                    </span>
                  </div>
                  <div className="kpi-grid inventory-grid">
                    {[
                      {
                        label: 'Total Businesses',
                        value: data.inventory.totalBusinesses,
                        icon: 'business',
                        description:
                          'All current business records across the platform, regardless of selected dates or entity filters.',
                      },
                      {
                        label: 'Active Businesses',
                        value: data.inventory.activeBusinesses,
                        icon: 'business',
                        description:
                          'Businesses currently marked ACTIVE. Current status is not historical status during the selected period.',
                      },
                      {
                        label: 'Inactive Businesses',
                        value: data.inventory.inactiveBusinesses,
                        icon: 'business',
                        description:
                          'Businesses currently marked INACTIVE, including those with historical activity.',
                      },
                      {
                        label: 'Total NFC/QR Stands',
                        value: data.inventory.totalStands,
                        icon: 'stand',
                        description:
                          'All current permanent stand records. A stand URL can be used through NFC, QR or a normal browser.',
                      },
                      {
                        label: 'Active Stands',
                        value: data.inventory.activeStands,
                        icon: 'stand',
                        description:
                          'Stands currently enabled. The assigned business must also be active and confirmed for public use.',
                      },
                    ].map((m) => (
                      <Kpi key={m.label} {...m} scope="Current inventory" />
                    ))}
                  </div>
                  <div className="metric-section-label">
                    <h2>Review journey</h2>
                    <span>Selected UTC dates and business / stand filters</span>
                  </div>
                  <div className="kpi-grid activity-grid">
                    {[
                      {
                        label: 'Total Review Page Visits',
                        value: data.activity.visits,
                        icon: 'visit',
                        description:
                          'Recorded PAGE_VIEW events. These are visits, not unique people or identified NFC/QR scans.',
                      },
                      {
                        label: 'Review Suggestions Generated',
                        value: data.activity.generations,
                        icon: 'generate',
                        description:
                          'Initial suggestion-generation events; each creates three drafts. Regenerations are counted separately: ' +
                          data.activity.regenerations +
                          '.',
                      },
                      {
                        label: 'Review Copies',
                        value: data.activity.copies,
                        icon: 'copy',
                        description:
                          'Recorded successful clipboard-copy events. These do not prove the review was pasted or submitted.',
                      },
                      {
                        label: 'Google Review Page Clicks',
                        value: data.activity.clicks,
                        icon: 'click',
                        description:
                          'Recorded Google outbound click attempts, including the copy-and-continue action. These are not published reviews.',
                      },
                      {
                        label: 'Google Click-Through Rate',
                        value: formatPercent(data.activity.ctr),
                        icon: 'rate',
                        description:
                          'Google outbound click events ÷ visit events × 100. Not a unique-person conversion rate. Can exceed 100%; no visits shows N/A.',
                      },
                    ].map((m) => (
                      <Kpi key={m.label} {...m} scope="Date-filtered activity" />
                    ))}
                  </div>
                  <div className="analytics-two-col trend-funnel">
                    <TrendChart data={data} />
                    <FunnelChart data={data} />
                  </div>
                  <div className="analytics-two-col">
                    <Ranking
                      rows={data.businessRows}
                      title="Top-performing businesses"
                      subtitle="Strongest Google outbound activity in this period"
                    />
                    <Ranking
                      rows={data.standRows}
                      title="Top-performing NFC/QR stands"
                      subtitle="Permanent stands ranked by recorded outbound clicks"
                    />
                  </div>
                  <div className="analytics-two-col">
                    <Distribution data={data} />
                    <section className="insight-card">
                      <div className="section-heading">
                        <div>
                          <h2>Recent activity</h2>
                          <p>Latest 20 events within the applied filters</p>
                        </div>
                      </div>
                      <ol className="activity-timeline">
                        {data.recent.map((r) => (
                          <li key={r.id}>
                            <i />
                            <div>
                              <strong>{r.businessName}</strong>
                              <p>
                                {eventNames[r.type]} · {r.standName}
                              </p>
                              <time dateTime={r.createdAt}>
                                {new Date(r.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })}{' '}
                                UTC
                              </time>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {!data.recent.length && (
                        <div className="chart-empty compact">
                          No recorded interactions for this selection.
                        </div>
                      )}
                    </section>
                  </div>
                </>
              ) : (
                <div className="report-summary-strip">
                  <span>
                    <strong>{integer(data.activity.visits)}</strong> page visits
                  </span>
                  <span>
                    <strong>{integer(data.activity.generations)}</strong> generations
                  </span>
                  <span>
                    <strong>{integer(data.activity.copies)}</strong> copies
                  </span>
                  <span>
                    <strong>{integer(data.activity.clicks)}</strong> Google clicks
                  </span>
                  <span>
                    <strong>{formatPercent(data.activity.ctr)}</strong> click / visit ratio
                  </span>
                </div>
              )}
              <section className="report-module">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">REPORT LIBRARY</p>
                    <h2>From insight to a shareable report</h2>
                    <p>
                      Search, sort and export the selected report with its definitions and filters.
                    </p>
                  </div>
                  <div className="report-export-actions">
                    <button
                      onClick={() => void download('csv')}
                      disabled={!!exporting || kind === 'templates'}
                    >
                      {exporting === 'csv' ? 'Exporting…' : 'CSV export'}
                    </button>
                    <button
                      onClick={() => void download('xlsx')}
                      disabled={!!exporting || kind === 'templates'}
                    >
                      {exporting === 'xlsx' ? 'Exporting…' : 'Excel export'}
                    </button>
                    <button onClick={() => window.print()} disabled={kind === 'templates'}>
                      Print / Save PDF
                    </button>
                  </div>
                </div>
                <div className="report-tabs" role="tablist" aria-label="Report types">
                  {reportKinds.map((k) => (
                    <button
                      role="tab"
                      tabIndex={kind === k ? 0 : -1}
                      onKeyDown={(e) => {
                        const index = reportKinds.indexOf(k);
                        const next =
                          e.key === 'ArrowRight'
                            ? reportKinds[(index + 1) % reportKinds.length]
                            : e.key === 'ArrowLeft'
                              ? reportKinds[(index + reportKinds.length - 1) % reportKinds.length]
                              : e.key === 'Home'
                                ? reportKinds[0]
                                : e.key === 'End'
                                  ? reportKinds[reportKinds.length - 1]
                                  : null;
                        if (next) {
                          e.preventDefault();
                          chooseReport(next);
                          document.getElementById('tab-' + next)?.focus();
                        }
                      }}
                      aria-selected={kind === k}
                      aria-controls="report-content"
                      id={'tab-' + k}
                      key={k}
                      onClick={() => chooseReport(k)}
                    >
                      {
                        {
                          overview: 'Overview',
                          business: 'Businesses',
                          stand: 'Stands',
                          funnel: 'Review funnel',
                          daily: 'Date-wise activity',
                          templates: 'Template usage',
                        }[k]
                      }
                    </button>
                  ))}
                </div>
                <div id="report-content" role="tabpanel" aria-labelledby={'tab-' + kind}>
                  {kind === 'templates' ? (
                    <div className="unsupported-report">
                      <h3>Template usage is not recorded</h3>
                      <p>{data.templateUsage.reason}</p>
                      <p>
                        Generation totals are available above. They cannot identify which template
                        phrases were shown or selected.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="report-selected-chart">
                        {kind === 'daily' ? (
                          <TrendChart data={data} />
                        ) : kind === 'funnel' ? (
                          <FunnelChart data={data} />
                        ) : kind === 'business' ? (
                          <Ranking
                            rows={data.businessRows}
                            title="Leading businesses"
                            subtitle="Selected period, ranked by Google clicks"
                          />
                        ) : kind === 'stand' ? (
                          <Ranking
                            rows={data.standRows}
                            title="Leading stands"
                            subtitle="Selected period, ranked by Google clicks"
                          />
                        ) : null}
                      </div>
                      <DataTable
                        data={data}
                        kind={kind}
                        search={search}
                        sort={sort}
                        direction={direction}
                        onSearch={setSearch}
                        onSort={setSort}
                        onDirection={setDirection}
                      />
                    </>
                  )}
                </div>
                <p className="report-help">
                  PDF: choose “Save as PDF” in your browser print dialog. The report uses A4
                  landscape and includes every matching row, applied filters, generation time and
                  definitions.
                </p>
              </section>
              <details className="analytics-definitions">
                <summary>How to read these numbers</summary>
                {data.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </details>
            </>
          )
        )}
      </div>
      {data && printTable && (
        <article className="report-print-only">
          <header>
            <p>ARVIK DIGITAL / SMART REVIEWS</p>
            <h1>{reportTitles[kind]}</h1>
            <p>Generated: {data.generatedAt} · Timezone: UTC</p>
            <p>Period: {applied}</p>
            <p>
              Search: {search || 'None'} · Sort: {sort} {direction} · Interval:{' '}
              {data.filters.interval}
            </p>
          </header>
          <section className="print-summary">
            <strong>{integer(data.activity.visits)} visits</strong>
            <strong>{integer(data.activity.generations)} generations</strong>
            <strong>{integer(data.activity.copies)} copies</strong>
            <strong>{integer(data.activity.clicks)} Google clicks</strong>
            <strong>{formatPercent(data.activity.ctr)} click / visit ratio</strong>
          </section>
          <table>
            <thead>
              <tr>
                {printTable.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printRows.map((row, i) => (
                <tr key={i}>
                  {printTable.columns.map((c) => (
                    <td key={c.key}>
                      {c.percentage
                        ? formatPercent(row[c.key] as number | null)
                        : row[c.key] === null
                          ? 'N/A'
                          : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!printRows.length && <p>No matching report rows.</p>}
          <footer>
            <h2>Definitions & limitations</h2>
            {data.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
            <p>
              Arvik Digital · Confidential administrator report · Google clicks are not confirmed
              published reviews.
            </p>
          </footer>
        </article>
      )}
    </div>
  );
}
function Kpi({
  label,
  value,
  icon,
  description,
  scope,
}: {
  label: string;
  value: string | number;
  icon: string;
  description: string;
  scope: string;
}) {
  return (
    <article className="kpi-card" aria-label={label}>
      <div className="kpi-top">
        <span className={'kpi-icon ' + (scope.startsWith('Current') ? 'inventory-icon' : '')}>
          <MetricIcon kind={icon as Parameters<typeof MetricIcon>[0]['kind']} />
        </span>
        <button
          className="kpi-info"
          type="button"
          aria-label={'About ' + label}
          aria-describedby={'metric-description-' + label.replaceAll(' ', '-')}
          title={description}
        >
          i
          <span
            id={'metric-description-' + label.replaceAll(' ', '-')}
            className="metric-tooltip"
            role="tooltip"
          >
            {description}
          </span>
        </button>
      </div>
      <p>{label}</p>
      <strong data-testid="kpi-value">{typeof value === 'number' ? integer(value) : value}</strong>
      <small>{scope}</small>
    </article>
  );
}
