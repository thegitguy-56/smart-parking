// PredictionChart.jsx
// Renders a time-series area chart for ONE slot's vacancy-probability forecast.
// Used inside SlotDetailSidebar when a slot is selected.
//
// Props:
//   data     — array of { ds: "2024-...", vacancy_prob: float } from fetchPredictions()
//   slotId   — string, used only for the chart title
//   loading  — bool

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Custom tooltip so it fits the dark theme
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-xs font-mono shadow-lg">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="text-emerald-400 font-bold">
        {(payload[0].value * 100).toFixed(1)}% vacant
      </p>
    </div>
  );
}

export default function PredictionChart({ data, slotId, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-36 text-zinc-600 text-xs font-mono">
        Loading forecast...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-zinc-600 text-xs font-mono">
        No forecast data
      </div>
    );
  }

  // Recharts needs plain objects. We shorten the timestamp label to HH:MM for readability.
  const chartData = data.map((row) => ({
    time: row.ds.slice(11, 16), // "2024-06-01T14:30:00" → "14:30"
    prob: parseFloat(row.vacancy_prob.toFixed(3)),
  }));

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-medium">
        Vacancy probability — {slotId}
      </p>
      {/*
        ResponsiveContainer makes the chart fill its parent's width.
        Height is fixed at 150px — compact enough for a sidebar.
      */}
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            {/* Gradient fill under the area curve */}
            <linearGradient id="vacancyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#71717a", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: "#71717a", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="prob"
            stroke="#34d399"
            strokeWidth={1.5}
            fill="url(#vacancyGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
