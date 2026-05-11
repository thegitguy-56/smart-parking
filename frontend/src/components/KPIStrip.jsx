// KPIStrip.jsx
// Top banner: Total | Occupied | Free | Occupancy %
// Works with the normalized status object from api.js:
//   { total: int, occupied: int, free: int, slots: {...} }
//
// Props:
//   status  — normalized status object
//   loading — bool

export default function KPIStrip({ status, loading }) {
  const pct =
    status && status.total > 0
      ? ((status.occupied / status.total) * 100).toFixed(1)
      : "0.0";

  const tiles = [
    { label: "Total Slots", value: status?.total    ?? "—", accent: "text-zinc-300" },
    { label: "Occupied",    value: status?.occupied ?? "—", accent: "text-amber-400" },
    { label: "Free",        value: status?.free     ?? "—", accent: "text-emerald-400" },
    { label: "Occupancy",   value: loading ? "—" : `${pct}%`, accent: "text-sky-400" },
  ];

  return (
    <div className="w-full grid grid-cols-4 border-b border-zinc-700 bg-zinc-900">
      {tiles.map((tile, i) => (
        <div
          key={i}
          className={`flex flex-col items-center justify-center py-4 ${
            i < tiles.length - 1 ? "border-r border-zinc-700" : ""
          }`}
        >
          <span className={`font-mono text-3xl font-bold tracking-tight ${tile.accent}`}>
            {tile.value}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}