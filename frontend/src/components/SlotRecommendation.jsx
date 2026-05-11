// SlotRecommendation.jsx
// Displays the top-3 slot recommendations returned by GET /recommend.
// Each card shows: rank, slot ID, composite score, distance, vacancy probability.
// Clicking a card fires onSelectSlot so the map + sidebar can highlight that slot.
//
// Props:
//   recommendations — array from fetchRecommendations():
//                     [{ slot_id, score, distance, vacancy_prob }, ...]
//   loading         — bool
//   onSelectSlot    — (slotId: string) => void

export default function SlotRecommendation({ recommendations, loading, onSelectSlot }) {
  // Rank labels and accent colors for 1st / 2nd / 3rd
  const rankMeta = [
    { label: "01", borderColor: "border-sky-500",  textColor: "text-sky-400"  },
    { label: "02", borderColor: "border-zinc-500",  textColor: "text-zinc-400" },
    { label: "03", borderColor: "border-amber-700", textColor: "text-amber-600" },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium px-1">
        Recommended slots
      </p>

      {loading && (
        <p className="text-xs text-zinc-600 font-mono px-1">Computing...</p>
      )}

      {!loading && (!recommendations || recommendations.length === 0) && (
        <p className="text-xs text-zinc-600 font-mono px-1">No recommendations available</p>
      )}

      {!loading &&
        recommendations?.map((rec, i) => {
          const meta = rankMeta[i] ?? rankMeta[2];
          return (
            <button
              key={rec.slot_id}
              onClick={() => onSelectSlot(rec.slot_id)}
              // Full-width card, left-bordered with rank color, clickable
              className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded bg-zinc-800 border-l-4 ${meta.borderColor} hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500`}
            >
              {/* Rank number */}
              <span className={`font-mono text-xl font-bold ${meta.textColor} w-8 shrink-0`}>
                {meta.label}
              </span>

              {/* Slot ID */}
              <span className="font-mono text-sm text-zinc-200 font-semibold flex-1 truncate">
                {rec.slot_id}
              </span>

              {/* Score + metrics */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="font-mono text-xs text-sky-400">
                  score {rec.score.toFixed(3)}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  dist {Math.round(rec.distance)}px
                </span>
                <span className="font-mono text-[10px] text-emerald-500">
                  {(rec.vacancy_prob * 100).toFixed(1)}% vacant
                </span>
              </div>
            </button>
          );
        })}
    </div>
  );
}
