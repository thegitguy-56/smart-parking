// OccupancyChart.jsx
// Live occupancy trend chart.
//
// Accumulates the last MAX_POINTS polling snapshots (occupied, free counts)
// in a local ring buffer. On each new `status` prop, it appends a data point.
// Renders a Recharts AreaChart with occupied (amber) vs free (emerald) areas.
//
// Props:
//   status    — normalized status object { occupied, free, total }
//   analytics — optional analytics summary from /analytics endpoint

import { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const MAX_POINTS = 30; // keep last 30 polling snapshots

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Custom tooltip rendered over the chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const occupied = payload.find((p) => p.dataKey === "occupied")?.value ?? 0;
  const free     = payload.find((p) => p.dataKey === "free")?.value ?? 0;
  const total    = occupied + free;
  const pct      = total > 0 ? ((occupied / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-1">{formatTime(label)}</p>
      <p className="text-amber-400">Occupied: {occupied}</p>
      <p className="text-emerald-400">Free: {free}</p>
      <p className="text-sky-400 mt-1">{pct}% full</p>
    </div>
  );
}

export default function OccupancyChart({ status, analytics }) {
  const [points, setPoints] = useState([]);
  const prevOccupied = useRef(null);

  // Append a new data point whenever occupied count changes
  useEffect(() => {
    if (!status || status.total === 0) return;
    if (status.occupied === prevOccupied.current) return; // skip if unchanged

    prevOccupied.current = status.occupied;

    setPoints((prev) => {
      const next = [
        ...prev,
        {
          ts:       Date.now(),
          occupied: status.occupied,
          free:     status.free,
        },
      ];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, [status]);

  const isEmpty = points.length === 0;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Live Occupancy Trend
        </p>
        {analytics && (
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
            <span>
              Avg&nbsp;
              <span className="text-sky-400">{analytics.avg_occupancy_pct}%</span>
            </span>
            <span>
              Peak hour&nbsp;
              <span className="text-amber-400">{String(analytics.peak_hour).padStart(2, "0")}:00</span>
            </span>
            {analytics.busiest_slot && (
              <span>
                Busiest&nbsp;
                <span className="text-emerald-400">{analytics.busiest_slot}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pt-2 pb-1" style={{ height: 160 }}>
        {isEmpty ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
            Collecting data — waiting for first frame…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradOccupied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradFree" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

              <XAxis
                dataKey="ts"
                tickFormatter={formatTime}
                tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                domain={[0, (dataMax) => Math.max(dataMax + 5, 20)]}
                allowDecimals={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="occupied"
                stroke="#fbbf24"
                strokeWidth={1.5}
                fill="url(#gradOccupied)"
                dot={false}
                activeDot={{ r: 3, fill: "#fbbf24" }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="free"
                stroke="#34d399"
                strokeWidth={1.5}
                fill="url(#gradFree)"
                dot={false}
                activeDot={{ r: 3, fill: "#34d399" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-5 px-4 pb-2 text-[10px] font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />
          <span className="text-zinc-500">Occupied</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />
          <span className="text-zinc-500">Free</span>
        </span>
        <span className="ml-auto text-zinc-600">last {points.length}/{MAX_POINTS} polls</span>
      </div>
    </div>
  );
}
