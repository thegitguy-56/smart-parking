// Controls.jsx
// Control panel. Lets the user:
//
//   1. Adjust prediction horizon (slider, 5–120 min)
//   2. See + reset the entry point set by clicking the parking map
//   3. Trigger a manual refresh
//
// The old raw-pixel Entry X/Y inputs are replaced with a read-only display
// that shows the currently selected entry point. The user sets it by clicking
// on the ParkingMap canvas directly (much more intuitive).
//
// Props:
//   horizon       — current horizon value (int)
//   setHorizon    — setter for horizon
//   entryX        — current X coordinate (int) — driven by map clicks
//   entryY        — current Y coordinate (int) — driven by map clicks
//   onResetEntry  — callback to reset entry point to (0, 0)
//   onRefresh     — callback to trigger an immediate data re-fetch

export default function Controls({
  horizon, setHorizon,
  entryX, entryY,
  onResetEntry,
  onRefresh,
}) {
  const hasEntry = entryX !== 0 || entryY !== 0;

  return (
    <div className="flex flex-wrap items-end gap-6 px-5 py-3 bg-zinc-900 border-b border-zinc-700">

      {/* --- Horizon slider --- */}
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Prediction Horizon
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5} max={120} step={5}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer"
          />
          <span className="font-mono text-sm text-sky-400 w-16 text-right whitespace-nowrap">
            {horizon} min
          </span>
        </div>
      </div>

      {/* --- Entry point (read-only, set by clicking the map) --- */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          Entry Point
        </label>
        <div className="flex items-center gap-2">
          {/* Display pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded font-mono text-xs border ${
              hasEntry
                ? "bg-pink-950/40 border-pink-700 text-pink-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-500"
            }`}
          >
            {/* Pink dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasEntry ? "bg-pink-400" : "bg-zinc-600"
              }`}
            />
            {hasEntry
              ? `(${entryX}, ${entryY})`
              : "Click map to set"}
          </div>

          {/* Reset button — only shown when an entry point is set */}
          {hasEntry && (
            <button
              onClick={onResetEntry}
              title="Reset entry point to origin"
              className="px-2 py-1 text-[10px] font-mono rounded border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <span className="text-[9px] text-zinc-600 font-mono pl-0.5">
          Click anywhere on the parking map to set
        </span>
      </div>

      {/* --- Refresh button --- */}
      <button
        onClick={onRefresh}
        className="ml-auto px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs uppercase tracking-widest font-semibold transition-colors"
      >
        Refresh Now
      </button>

    </div>
  );
}
