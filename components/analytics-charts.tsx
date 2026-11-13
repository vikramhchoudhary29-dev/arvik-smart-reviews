'use client';
import {
  formatPercent,
  funnelRows,
  type AnalyticsSnapshot,
  type Performance,
} from '@/lib/analytics-model';
const colors = { visits: '#6b91ff', clicks: '#39d3ac' };
export function TrendChart({ data }: { data: AnalyticsSnapshot }) {
  const points = data.series;
  const max = Math.max(1, ...points.flatMap((p) => [p.visits, p.clicks]));
  const width = 800,
    height = 230,
    pad = 36;
  const x = (i: number) =>
    pad + (width - 2 * pad) * (points.length === 1 ? 0.5 : i / (points.length - 1));
  const y = (n: number) => height - pad - ((height - 2 * pad) * n) / max;
  const path = (key: 'visits' | 'clicks') =>
    points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join(' ');
  const total = points.reduce((n, p) => n + p.visits + p.clicks, 0);
  return (
    <section className="insight-card">
      <div className="section-heading">
        <div>
          <h2>Activity over time</h2>
          <p>Review page visits and Google outbound clicks · {data.filters.interval}</p>
        </div>
        <div className="chart-legend">
          <span>
            <i style={{ background: colors.visits }} />
            Visits
          </span>
          <span>
            <i style={{ background: colors.clicks }} />
            Google clicks
          </span>
        </div>
      </div>
      {!total ? (
        <div className="chart-empty">
          No visits or Google clicks in this period. Try another date range or entity filter.
        </div>
      ) : (
        <div className="trend-plot">
          <svg
            viewBox={'0 0 ' + width + ' ' + height}
            role="img"
            aria-label="Visits versus Google outbound clicks over the selected period"
          >
            <title>
              Activity trends. Full numeric values are available in the date-wise report.
            </title>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1={pad}
                  x2={width - pad}
                  y1={y(max * f)}
                  y2={y(max * f)}
                  stroke="#2b3850"
                  strokeDasharray="4 5"
                />
                <text x={pad - 8} y={y(max * f) + 4} textAnchor="end" fill="#8e9db6" fontSize="11">
                  {Math.round(max * f)}
                </text>
              </g>
            ))}
            {(['visits', 'clicks'] as const).map((key) => (
              <g key={key}>
                <path
                  d={path(key)}
                  fill="none"
                  stroke={colors[key]}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {points.length <= 40 &&
                  points.map((p, i) => (
                    <circle key={i} cx={x(i)} cy={y(p[key])} r="3" fill={colors[key]}>
                      <title>
                        {p.period} · {key}: {p[key]}
                      </title>
                    </circle>
                  ))}
              </g>
            ))}
            {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((i) => (
              <text
                key={i}
                x={x(i)}
                y={height - 9}
                textAnchor="middle"
                fill="#94a7c4"
                fontSize="11"
              >
                {points[i]?.period}
              </text>
            ))}
          </svg>
        </div>
      )}
      <p className="chart-caption">
        UTC calendar buckets. Missing dates show zero. Partial weeks/months include only the
        selected dates.
      </p>
    </section>
  );
}
export function FunnelChart({ data }: { data: AnalyticsSnapshot }) {
  const rows = funnelRows(data),
    max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="insight-card">
      <div className="section-heading">
        <div>
          <h2>Review interaction funnel</h2>
          <p>Independent event counts · not confirmed reviews</p>
        </div>
      </div>
      <div className="funnel-list">
        {rows.map((r, i) => (
          <div className="funnel-item" key={r.stage}>
            <div>
              <span className="stage-number">0{i + 1}</span>
              <span>{r.stage}</span>
              <strong>{r.count.toLocaleString()}</strong>
            </div>
            <div className="funnel-track">
              <span
                style={{
                  width: (r.count / max) * 100 + '%',
                  background: ['#6b91ff', '#9c85f6', '#39d3ac', '#5ee6c2'][i],
                }}
              />
            </div>
            <small>
              {formatPercent(r.visitRatio)} of visit events
              {r.visitRatio !== null && r.visitRatio > 100
                ? ' · repeated interactions possible'
                : ''}
            </small>
          </div>
        ))}
      </div>
      <p className="chart-caption">
        These are not the same verified people moving between stages. Regenerations are counted
        separately.
      </p>
    </section>
  );
}
export function Ranking({
  rows,
  title,
  subtitle,
}: {
  rows: Performance[];
  title: string;
  subtitle: string;
}) {
  const ranked = rows
      .filter((r) => r.clicks > 0)
      .toSorted(
        (a, b) => b.clicks - a.clicks || b.visits - a.visits || a.name.localeCompare(b.name),
      )
      .slice(0, 5),
    max = Math.max(1, ...ranked.map((r) => r.clicks));
  return (
    <section className="insight-card">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="scope-badge">By Google clicks</span>
      </div>
      {ranked.length ? (
        <ol className="ranking-list">
          {ranked.map((r, i) => (
            <li key={r.id}>
              <span className="rank-number">{i + 1}</span>
              <div>
                <div className="rank-label">
                  <strong title={r.name}>{r.name}</strong>
                  <span>{r.clicks.toLocaleString()}</span>
                </div>
                <div className="rank-track">
                  <span style={{ width: (r.clicks / max) * 100 + '%' }} />
                </div>
                <small>
                  {r.visits.toLocaleString()} visits · {formatPercent(r.ctr)} click / visit ratio
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="chart-empty compact">
          No Google outbound clicks recorded for these filters.
        </div>
      )}
    </section>
  );
}
export function Distribution({ data }: { data: AnalyticsSnapshot }) {
  const total = data.businessRows.reduce((n, b) => n + b.visits, 0);
  const sorted = data.businessRows
    .filter((b) => b.visits > 0)
    .toSorted((a, b) => b.visits - a.visits);
  const rows = sorted.slice(0, 5).map((b) => ({ name: b.name, value: b.visits }));
  const other = sorted.slice(5).reduce((n, b) => n + b.visits, 0);
  if (other) rows.push({ name: 'Other businesses', value: other });
  const palette = ['#6b91ff', '#39d3ac', '#9c85f6', '#f2b966', '#4ab8d7', '#64748b'];
  let offset = 0;
  const stops = rows
    .map((r, i) => {
      const start = offset;
      offset += (r.value / Math.max(1, total)) * 100;
      return palette[i] + ' ' + start + '% ' + offset + '%';
    })
    .join(',');
  return (
    <section className="insight-card">
      <div className="section-heading">
        <div>
          <h2>Business activity distribution</h2>
          <p>Share of recorded page visits in this scope</p>
        </div>
      </div>
      {total ? (
        <div className="distribution">
          <div
            className="donut"
            style={{ background: 'conic-gradient(' + stops + ')' }}
            role="img"
            aria-label="Distribution of visits by business"
          >
            <div>
              <strong>{total.toLocaleString()}</strong>
              <span>visits</span>
            </div>
          </div>
          <ul>
            {rows.map((r, i) => (
              <li key={r.name}>
                <i style={{ background: palette[i] }} />
                <span title={r.name}>{r.name}</span>
                <strong>{formatPercent((100 * r.value) / total)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="chart-empty compact">No visits to distribute in the selected period.</div>
      )}
    </section>
  );
}
