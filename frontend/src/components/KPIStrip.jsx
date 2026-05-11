// KPIStrip.jsx
// A horizontal strip that shows four key numbers at a glance:
//   Total slots | Occupied | Free | Occupancy %
//
// Props:
//   status  — object from fetchStatus(): { total, occupied, free }
//   loading — bool, true while first fetch is in flight

export default function KPIStrip({ status, loading }) {
  // Derive occupancy percentage. Guard against division by zero.
  const pct =
    status && status.total > 0
      ? ((status.occupied / status.total) * 100).toFixed(1)
      : "—";

  // Each tile has a label, a value, and an optional color accent class.
  const tiles = [
    { label: "Total Slots", value: status?.total ?? "—", accent: "text-zinc-300" },
    { label: "Occupied",    value: status?.occupied ?? "—", accent: "text-amber-400" },
    { label: "Free",        value: status?.free ?? "—",     accent: "text-emerald-400" },
    { label: "Occupancy",   value: loading ? "—" : `${pct}%`, accent: "text-sky-400" },
  ];

  return (
    // Full-width strip, dark background with a subtle bottom border.
    <div className="w-full grid grid-cols-4 border-b border-zinc-700 bg-zinc-900">
      {tiles.map((tile, i) => (
        <div
          key={i}
          // Each tile is a flex column, centered.
          // Divide tiles with a right border except the last one.
          className={`flex flex-col items-center justify-center py-4 ${
            i < tiles.length - 1 ? "border-r border-zinc-700" : ""
          }`}
        >
          {/* The big number — monospaced so digits don't jump during updates */}
          <span className={`font-mono text-3xl font-bold tracking-tight ${tile.accent}`}>
            {tile.value}
          </span>
          {/* Small all-caps label beneath */}
          <span className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}
