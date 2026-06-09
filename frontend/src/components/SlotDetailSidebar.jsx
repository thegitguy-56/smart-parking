// SlotDetailSidebar.jsx
// Right sidebar shown when a slot is clicked on the map.
//
// Props:
//   slot         — slot_id string e.g. "slot_003", or null
//   status       — normalized: { slots: { id: { occupied: bool, confidence: float } } }
//   slotMap      — normalized: { id: { bbox: [x,y,w,h], centroid: [cx,cy] } }
//   predictions  — normalized: { "slot_001": 0.73, ... }
//   horizon      — int (minutes), forwarded to PredictionChart label
//   onClose      — callback to deselect

import PredictionChart from "./PredictionChart";

export default function SlotDetailSidebar({ slot, status, slotMap, predictions, horizon = 30, onClose }) {
  if (!slot) return null;

  const slotStatus  = status?.slots?.[slot];
  const slotMeta    = slotMap?.[slot];
  const vacancyProb = predictions?.[slot];

  const occupied   = slotStatus?.occupied ?? null;
  const confidence = slotStatus?.confidence ?? null;
  const bbox       = slotMeta?.bbox;
  const centroid   = slotMeta?.centroid;

  // Confidence color thresholds
  const confColor =
    confidence === null ? "text-zinc-500" :
    confidence >= 0.9   ? "text-emerald-400" :
    confidence >= 0.7   ? "text-amber-400"   :
    "text-red-400";

  const confLabel =
    confidence === null ? "" :
    confidence >= 0.9   ? "High confidence" :
    confidence >= 0.7   ? "Medium confidence" :
    "Low confidence";

  return (
    <aside className="w-72 min-w-[280px] flex flex-col bg-zinc-900 border-l border-zinc-700 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center gap-2">
          {/* Small status dot */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              occupied === null ? "bg-zinc-600" :
              occupied          ? "bg-amber-400" :
              "bg-emerald-400"
            }`}
          />
          <span className="font-mono text-sm text-zinc-100 font-bold tracking-wide">
            {slot}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-base leading-none"
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Status badge + confidence */}
      <div className="px-4 py-3 border-b border-zinc-700 flex items-center gap-3">
        {occupied === null ? (
          <span className="text-xs text-zinc-500 font-mono">Status unknown</span>
        ) : occupied ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-900/50 border border-amber-600 text-amber-400 text-xs font-mono font-semibold tracking-wide">
            OCCUPIED
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-600 text-emerald-400 text-xs font-mono font-semibold tracking-wide">
            FREE
          </span>
        )}
        {confidence !== null && (
          <div className="flex flex-col items-end ml-auto">
            <span className={`text-xs font-mono font-bold ${confColor}`}>
              {(confidence * 100).toFixed(1)}%
            </span>
            <span className={`text-[9px] font-mono ${confColor} opacity-75`}>
              {confLabel}
            </span>
          </div>
        )}
      </div>

      {/* Confidence bar */}
      {confidence !== null && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(confidence * 100).toFixed(1)}%`,
                backgroundColor:
                  confidence >= 0.9 ? "#34d399" :
                  confidence >= 0.7 ? "#fbbf24" : "#f87171",
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-zinc-600 font-mono">Model confidence</span>
          </div>
        </div>
      )}

      {/* Coordinates */}
      {slotMeta && (
        <div className="px-4 py-3 border-b border-zinc-700 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-2">
            Coordinates
          </p>
          {bbox && (
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span className="text-zinc-600">BBox</span>
              <span>{bbox.map((v) => Math.round(v)).join(", ")}</span>
            </div>
          )}
          {centroid && (
            <div className="flex justify-between text-xs font-mono text-zinc-400">
              <span className="text-zinc-600">Centroid</span>
              <span>({Math.round(centroid[0])}, {Math.round(centroid[1])})</span>
            </div>
          )}
        </div>
      )}

      {/* Vacancy forecast */}
      <div className="px-4 py-4 flex-1">
        <PredictionChart
          vacancyProb={vacancyProb}
          slotId={slot}
          horizon={horizon}
        />
      </div>

    </aside>
  );
}