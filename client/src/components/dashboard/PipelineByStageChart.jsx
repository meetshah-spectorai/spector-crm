import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/utils/format';

/**
 * Open pipeline value by stage.
 *
 * One measure across ordered categories → a horizontal bar chart, single hue.
 * Won/lost columns are deliberately excluded: they are closed outcomes, reported
 * in the KPI tiles, and mixing them in would put two meanings on one scale. Which
 * columns count as open comes from each stage's configured outcome.
 */

const BAR_COLOR = '#4f46e5'; // brand-600 — validated against the light surface
const BAR_COLOR_EMPTY = '#e2e8f0'; // slate-200, for zero-value stages

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lift">
      <p className="text-xs font-semibold text-slate-900">{row.label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
        {formatMoney(row.value, row.currency)}
      </p>
      <p className="text-xs text-slate-500">
        {row.count} {row.count === 1 ? 'deal' : 'deals'}
      </p>
    </div>
  );
}

export default function PipelineByStageChart({ byStage = [], currency = 'USD' }) {
  const data = byStage
    .filter((s) => s.outcome === 'open')
    .map((s) => ({
      stage: s.stage,
      label: s.label,
      value: s.value || 0,
      count: s.count || 0,
      currency,
    }));

  const hasData = data.some((d) => d.value > 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="card p-4 sm:p-5">
      <header className="mb-1">
        <h2 className="text-sm font-semibold text-slate-900">Open pipeline by stage</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {hasData
            ? `${formatMoney(total, currency)} across ${data.reduce((s, d) => s + d.count, 0)} open deals`
            : 'No open deals yet — add one from the pipeline board.'}
        </p>
      </header>

      {/* Charts are images to assistive tech; the table below carries the data. */}
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No open columns on the board yet.
        </p>
      ) : (
      <div
        // Grows with the column count, since stages are configurable.
        style={{ height: Math.max(160, data.length * 46) }}
        className="w-full"
        role="img"
        aria-label={`Open pipeline value by stage. ${data
          .map((d) => `${d.label}: ${formatMoney(d.value, currency)}`)
          .join('. ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 0, left: 0 }}
            barCategoryGap={10}
          >
            {/* Recessive grid: vertical guides only, no axis lines or ticks. */}
            <CartesianGrid horizontal={false} stroke="#eef2f6" />
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: '#f8fafc' }}
              animationDuration={120}
            />
            <Bar dataKey="value" barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.stage} fill={row.value > 0 ? BAR_COLOR : BAR_COLOR_EMPTY} />
              ))}
              {/* Direct labels replace a numeric axis — a handful of bars need no scale. */}
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                fill="#334155"
                fontSize={12}
                fontWeight={600}
                formatter={(value) => formatMoneyCompact(value, currency)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}

      <table className="sr-only">
        <caption>Open pipeline value by stage</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Deals</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.stage}>
              <th scope="row">{row.label}</th>
              <td>{row.count}</td>
              <td>{formatMoney(row.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
