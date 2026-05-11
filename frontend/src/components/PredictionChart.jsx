// PredictionChart.jsx
// Shows the vacancy probability for a single slot.
// After normalization, predictions is { "slot_001": 0.73, ... } — a single
// float per slot, not a time series. So we render a simple probability gauge
// bar instead of a line chart. If the backend is later updated to return
// time-series data, this component can be upgraded to a full AreaChart.
//
// Props:
//   vacancyProb — float 0–1, the normalized vacancy probability for this slot
//   slotId      — string, used for the label

export default function PredictionChart({ vacancyProb, slotId }) {
  if (vacancyProb === undefined || vacancyProb === null) {
    return (
      <div className="flex items-center justify-center h-20 text-zinc-600 text-xs font-mono">
        No forecast data
      </div>
    );
  }

  const pct = (vacancyProb * 100).toFixed(1);

  // Color the bar based on probability: high vacancy = green, low = red
  const barColor =
    vacancyProb >= 0.6 ? "#34d399" :
    vacancyProb >= 0.3 ? "#fbbf24" :
    "#f87171";

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-medium">
        Vacancy forecast — {slotId}
      </p>

      {/* Big percentage readout */}
      <div className="flex items-end gap-2 mb-2">
        <span
          className="font-mono text-4xl font-bold"
          style={{ color: barColor }}
        >
          {pct}%
        </span>
        <span className="text-zinc-500 text-xs font-mono mb-1">
          chance of being free in {"{horizon}"} min
        </span>
      </div>

      {/* Probability bar */}
      <div className="w-full h-2 rounded-full bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-zinc-600 font-mono">0%</span>
        <span className="text-[9px] text-zinc-600 font-mono">100%</span>
      </div>
    </div>
  );
}