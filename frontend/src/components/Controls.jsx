// Controls.jsx
// A control panel that lets the user configure two things:
//
//   1. Prediction horizon (minutes) — how far ahead Prophet should forecast.
//      Represented as a slider from 5 to 120 minutes.
//
//   2. Entry point (X, Y pixel coordinates in the parking lot image).
//      Used by the recommender's distance scorer.
//      Defaults to (0, 0) — top-left corner of the lot.
//
// Props:
//   horizon       — current horizon value (int)
//   setHorizon    — setter for horizon
//   entryX        — current X coordinate (int)
//   setEntryX     — setter for entryX
//   entryY        — current Y coordinate (int)
//   setEntryY     — setter for entryY
//   onRefresh     — callback to trigger an immediate data re-fetch

export default function Controls({
  horizon, setHorizon,
  entryX, setEntryX,
  entryY, setEntryY,
  onRefresh,
}) {
  return (
    <div className="flex flex-wrap items-end gap-6 px-5 py-4 bg-zinc-900 border-b border-zinc-700">

      {/* --- Horizon slider --- */}
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Prediction horizon
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            // Tailwind doesn't style range inputs natively — inline accent-color handles the thumb.
            className="w-full accent-sky-400 cursor-pointer"
          />
          {/* Show the current value in a monospaced pill */}
          <span className="font-mono text-sm text-sky-400 w-16 text-right whitespace-nowrap">
            {horizon} min
          </span>
        </div>
      </div>

      {/* --- Entry point X --- */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Entry X (px)
        </label>
        <input
          type="number"
          min={0}
          value={entryX}
          onChange={(e) => setEntryX(Number(e.target.value))}
          className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 font-mono text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* --- Entry point Y --- */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Entry Y (px)
        </label>
        <input
          type="number"
          min={0}
          value={entryY}
          onChange={(e) => setEntryY(Number(e.target.value))}
          className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 font-mono text-sm text-zinc-200 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* --- Refresh button --- */}
      <button
        onClick={onRefresh}
        className="ml-auto px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs uppercase tracking-widest font-semibold transition-colors"
      >
        Refresh now
      </button>
    </div>
  );
}
