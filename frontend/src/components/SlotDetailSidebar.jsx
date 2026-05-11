// SlotDetailSidebar.jsx
// Slides in from the right when the user clicks a slot on the map.
// Shows:
//   - Slot ID + occupied/free badge
//   - Confidence score from the classifier
//   - Bounding-box and centroid coordinates from slot_map.json
//   - PredictionChart for that slot's vacancy forecast
//
// Props:
//   slot         — slot_id string, or null if none selected
//   status       — object from fetchStatus(): { slots: { id: { occupied, confidence } } }
//   slotMap      — object from fetchSlots(): { id: { bbox, centroid } }
//   predictions  — object from fetchPredictions(): { id: [{ ds, vacancy_prob }] }
//   onClose      — callback to deselect the slot

import PredictionChart from "./PredictionChart";

export default function SlotDetailSidebar({ slot, status, slotMap, predictions, onClose }) {
  // If no slot is selected, render nothing.
  // The parent controls width with a conditional class so the sidebar slides in/out.
  if (!slot) return null;

  const slotStatus = status?.slots?.[slot];
  const slotMeta   = slotMap?.[slot];
  const forecast   = predictions?.[slot] ?? [];

  const occupied   = slotStatus?.occupied ?? null;
  const confidence = slotStatus?.confidence ?? null;
  const bbox       = slotMeta?.bbox;       // [x, y, w, h]
  const centroid   = slotMeta?.centroid;   // [cx, cy]

  return (
    <aside className="w-72 min-w-[280px] flex flex-col bg-zinc-900 border-l border-zinc-700 overflow-y-auto">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <span className="font-mono text-sm text-zinc-200 font-bold tracking-wide">
          {slot}
        </span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-lg leading-none transition-colors"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 py-3 border-b border-zinc-700 flex items-center gap-3">
        {occupied === null ? (
          <span className="text-xs text-zinc-500 font-mono">Status unknown</span>
        ) : occupied ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-900/50 border border-amber-600 text-amber-400 text-xs font-mono font-semibold">
            OCCUPIED
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-600 text-emerald-400 text-xs font-mono font-semibold">
            FREE
          </span>
        )}
        {confidence !== null && (
          <span className="text-xs text-zinc-500 font-mono ml-auto">
            conf {(confidence * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Spatial metadata */}
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
              <span>
                ({Math.round(centroid[0])}, {Math.round(centroid[1])})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Vacancy forecast chart */}
      <div className="px-4 py-4">
        <PredictionChart data={forecast} slotId={slot} loading={false} />
      </div>

    </aside>
  );
}
