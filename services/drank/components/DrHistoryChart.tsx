'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Point = { ts: number; dr: number };

export function DrHistoryChart({ history }: { history: Point[] }) {
  return (
    <ResponsiveContainer>
      <AreaChart
        data={history.map((p) => ({
          date: new Date(p.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          DR: p.dr,
        }))}
      >
        <defs>
          <linearGradient id="drGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 2" stroke="#27272a" />
        <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: '#18181b',
            border: 'none',
            borderRadius: 8,
            color: '#e4e4e7',
          }}
        />
        <Area
          type="natural"
          dataKey="DR"
          stroke="#22c55e"
          strokeWidth={2.5}
          fill="url(#drGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
