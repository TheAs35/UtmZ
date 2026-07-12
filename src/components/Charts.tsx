import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { DayPoint, BreakdownRow } from '../lib/stats'

// Tema dark do app (validado p/ contraste na superfície #171b22)
const SERIES = '#4f8cff'
const GRID = '#2a3140'
const MUTED = '#8b94a7'

export function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

interface TipProps {
  active?: boolean
  label?: string
  payload?: { value?: number }[]
}

function ChartTip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0].value ?? 0
  return (
    <div className="chart-tip">
      <span className="muted">{label}</span>
      <strong>{value}</strong> {value === 1 ? 'clique' : 'cliques'}
    </div>
  )
}

export function TimelineChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="chart-area">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: MUTED }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: MUTED }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTip />} cursor={{ stroke: MUTED, strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={SERIES}
            strokeWidth={2}
            fill={SERIES}
            fillOpacity={0.15}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  return (
    <div className="card breakdown-card">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="muted">Sem dados no período.</p>
      ) : (
        <div className="bar-list">
          {rows.map((row) => (
            <div className="bar-row" key={row.label} title={`${row.label}: ${row.count}`}>
              <span className="bar-label">{row.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${max > 0 ? (row.count / max) * 100 : 0}%` }} />
              </span>
              <span className="bar-count">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
