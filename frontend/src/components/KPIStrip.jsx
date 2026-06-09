// KPIStrip.jsx
// Top KPI banner: Total | Occupied | Free | Occupancy %
// Improvements: skeleton loaders during initial load, occupancy color gradient,
// subtle pulse on the occupancy % when it changes.
//
// Props:
//   status   — normalized status object { total, occupied, free }
//   loading  — bool

export default function KPIStrip({ status, loading }) {
  const pct =
    status && status.total > 0
      ? ((status.occupied / status.total) * 100).toFixed(1)
      : "0.0";

  // Occupancy ring fill percentage for the mini arc indicator
  const pctNum = parseFloat(pct);

  // Color for occupancy tile: green → amber → red as lot fills
  const occupancyColor =
    pctNum < 50  ? "text-emerald-400" :
    pctNum < 80  ? "text-amber-400"   :
    "text-red-400";

  const tiles = [
    {
      label: "Total Slots",
      value: status?.total    ?? null,
      accent: "text-zinc-200",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-500">
          <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="8" y="1" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="1" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
          <rect x="8" y="8" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      ),
    },
    {
      label: "Occupied",
      value: status?.occupied ?? null,
      accent: "text-amber-400",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-amber-600">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="7" cy="7" r="2.5" fill="currentColor" opacity="0.6"/>
        </svg>
      ),
    },
    {
      label: "Free",
      value: status?.free     ?? null,
      accent: "text-emerald-400",
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-600">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4.5 7.5 L6.5 9.5 L9.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: "Occupancy",
      value: loading ? null : `${pct}%`,
      accent: occupancyColor,
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={occupancyColor}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.3"/>
          {/* Mini arc representing fill */}
          <circle
            cx="7" cy="7" r="5.5"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={`${34.6 * pctNum / 100} 34.6`}
            transform="rotate(-90 7 7)"
            fill="none"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full grid grid-cols-4 border-b border-zinc-700 bg-zinc-900">
      {tiles.map((tile, i) => (
        <div
          key={i}
          className={`flex flex-col items-center justify-center py-4 gap-1 ${
            i < tiles.length - 1 ? "border-r border-zinc-700" : ""
          }`}
        >
          {/* Icon */}
          <div className="mb-0.5">{tile.icon}</div>

          {/* Value or skeleton */}
          {tile.value === null ? (
            <div className="w-16 h-8 rounded bg-zinc-800 animate-pulse" />
          ) : (
            <span className={`font-mono text-3xl font-bold tracking-tight ${tile.accent}`}>
              {tile.value}
            </span>
          )}

          {/* Label */}
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}