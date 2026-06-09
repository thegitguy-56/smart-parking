// PredictionChart.jsx
// Shows the vacancy probability for a single slot.
// After normalization, predictions is { "slot_001": 0.73, ... } — a single
// float per slot, not a time series. We render a visual probability gauge.
//
// Props:
//   vacancyProb — float 0–1
//   slotId      — string, used for the label
//   horizon     — int (minutes), displayed in the label

export default function PredictionChart({ vacancyProb, slotId, horizon = 30 }) {
  if (vacancyProb === undefined || vacancyProb === null) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-1">
        <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-zinc-500 animate-spin" />
        <span className="text-zinc-600 text-xs font-mono">No forecast data</span>
      </div>
    );
  }

  const pct = (vacancyProb * 100).toFixed(1);

  // Color the bar based on probability: high vacancy = green, low = red
  const barColor =
    vacancyProb >= 0.6 ? "#34d399" :
    vacancyProb >= 0.3 ? "#fbbf24" :
    "#f87171";

  const bgColor =
    vacancyProb >= 0.6 ? "bg-emerald-900/20" :
    vacancyProb >= 0.3 ? "bg-amber-900/20" :
    "bg-red-900/20";

  const label =
    vacancyProb >= 0.6 ? "Likely free" :
    vacancyProb >= 0.3 ? "Uncertain" :
    "Likely occupied";

  return (
    <div className="w-full">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-medium">
        Vacancy Forecast — {slotId}
      </p>

      {/* Probability ring + readout */}
      <div className={`flex items-center gap-4 p-3 rounded-lg ${bgColor} mb-3`}>
        {/* SVG arc gauge */}
        <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
          {/* Background circle */}
          <circle cx="30" cy="30" r="24" fill="none" stroke="#27272a" strokeWidth="6" />
          {/* Arc: circumference of r=24 is ~150.8px */}
          <circle
            cx="30" cy="30" r="24"
            fill="none"
            stroke={barColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${150.8 * vacancyProb} 150.8`}
            transform="rotate(-90 30 30)"
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
          <text x="30" y="34" textAnchor="middle" fill={barColor}
                fontSize="11" fontWeight="700" fontFamily="monospace">
            {Math.round(vacancyProb * 100)}%
          </text>
        </svg>

        {/* Text info */}
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-bold" style={{ color: barColor }}>
            {label}
          </span>
          <span className="text-zinc-500 text-[11px] font-mono">
            {pct}% chance free
          </span>
          <span className="text-zinc-600 text-[10px] font-mono">
            in {horizon} min
          </span>
        </div>
      </div>

      {/* Linear bar for precise reading */}
      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-zinc-600 font-mono">0% occupied</span>
        <span className="text-[9px] text-zinc-600 font-mono">100% free</span>
      </div>
    </div>
  );
}