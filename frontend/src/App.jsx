// App.jsx
// Root component. Responsible for:
//   1. Holding ALL application state (status, slotMap, predictions, etc.)
//   2. Fetching data from the API on mount and every 5 seconds (polling)
//   3. Laying out all child components
//
// Layout (left-to-right):
//   +------------------------------------------------------------------+
//   |  KPIStrip (full width)                                           |
//   +------------------------------------------------------------------+
//   |  Controls (full width)                                           |
//   +-------------------------------+----------+------------------------+
//   |  Left sidebar (20%)           |  Map (flex-1, center)            |
//   |  - SlotRecommendation         |  - ParkingMap                    |
//   +-------------------------------+----------------------------------+
//   |                               |  Right sidebar (conditional)     |
//   |                               |  - SlotDetailSidebar             |
//   +-------------------------------+----------------------------------+
//
// Why lift state to App?
//   Multiple components need the same data (e.g. both ParkingMap and
//   SlotDetailSidebar need status + slotMap). React's rule: lift state
//   to the nearest common ancestor — which is App.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStatus,
  fetchFrame,
  fetchPredictions,
  fetchRecommendations,
  fetchSlots,
} from "./api";

import KPIStrip           from "./components/KPIStrip";
import Controls           from "./components/Controls";
import ParkingMap         from "./components/ParkingMap";
import SlotRecommendation from "./components/SlotRecommendation";
import SlotDetailSidebar  from "./components/SlotDetailSidebar";

// How often to auto-refresh, in milliseconds.
const POLL_INTERVAL = 5000;

export default function App() {
  // --- Control state (user-configurable) ---
  const [horizon, setHorizon] = useState(30);
  const [entryX,  setEntryX]  = useState(0);
  const [entryY,  setEntryY]  = useState(0);

  // --- Data state (from API) ---
  const [status,          setStatus]          = useState(null);
  const [frameUrl,        setFrameUrl]         = useState(null);
  const [predictions,     setPredictions]      = useState(null);
  const [recommendations, setRecommendations]  = useState([]);
  const [slotMap,         setSlotMap]          = useState(null);

  // --- UI state ---
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Keep a ref to the previous frame blob URL so we can revoke it
  // (prevent memory leaks from URL.createObjectURL).
  const prevFrameUrl = useRef(null);

  // --- Main fetch function ---
  // useCallback memoizes the function so the polling useEffect doesn't
  // recreate it on every render (which would restart the interval).
  const fetchAll = useCallback(async () => {
    try {
      setError(null);

      // Fetch status and slotMap in parallel — they don't depend on each other.
      const [newStatus, newSlotMap] = await Promise.all([
        fetchStatus(),
        fetchSlots(),
      ]);
      setStatus(newStatus);
      setSlotMap(newSlotMap);

      // Fetch frame (blob) and revoke the previous blob URL to free memory.
      const newFrameUrl = await fetchFrame();
      if (prevFrameUrl.current) URL.revokeObjectURL(prevFrameUrl.current);
      prevFrameUrl.current = newFrameUrl;
      setFrameUrl(newFrameUrl);

      // Fetch predictions and recommendations with current control values.
      const [newPredictions, newRecs] = await Promise.all([
        fetchPredictions(horizon),
        fetchRecommendations(entryX, entryY, horizon),
      ]);
      setPredictions(newPredictions);
      setRecommendations(newRecs);

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [horizon, entryX, entryY]);

  // --- Initial fetch on mount ---
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Polling: re-fetch every POLL_INTERVAL ms ---
  // When horizon / entryX / entryY change, fetchAll changes (via useCallback),
  // which causes this effect to re-run — restarting the interval with the new params.
  useEffect(() => {
    const id = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(id); // cleanup on unmount or re-run
  }, [fetchAll]);

  // --- Slot selection ---
  // Clicking a slot on the map OR a recommendation card sets selectedSlot.
  function handleSelectSlot(slotId) {
    setSelectedSlot((prev) => (prev === slotId ? null : slotId)); // toggle
  }

  return (
    // Full-viewport dark container
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans">

      {/* Top bar: app title */}
      <header className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          {/* Simple grid icon as a logo mark */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-sky-400">
            <rect x="1" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="12" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="1" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="12" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="font-mono text-sm font-bold tracking-widest text-zinc-100 uppercase">
            Smart Parking
          </span>
        </div>

        {/* Live indicator dot */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              loading ? "bg-zinc-600" : error ? "bg-red-500" : "bg-emerald-400 animate-pulse"
            }`}
          />
          {error ? "Connection error" : loading ? "Connecting..." : "Live"}
        </div>
      </header>

      {/* KPI strip */}
      <KPIStrip status={status} loading={loading} />

      {/* Controls bar */}
      <Controls
        horizon={horizon}    setHorizon={setHorizon}
        entryX={entryX}      setEntryX={setEntryX}
        entryY={entryY}      setEntryY={setEntryY}
        onRefresh={fetchAll}
      />

      {/* Error banner (only shown when there's an error) */}
      {error && (
        <div className="px-5 py-2 bg-red-950 border-b border-red-800 text-red-400 text-xs font-mono">
          Error: {error}. Check that the backend is running and VITE_API_URL is correct.
        </div>
      )}

      {/* Main content area: left sidebar + map + right sidebar */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar: recommendations */}
        <aside className="w-64 min-w-[240px] flex flex-col gap-4 p-4 bg-zinc-900 border-r border-zinc-700 overflow-y-auto">
          <SlotRecommendation
            recommendations={recommendations}
            loading={loading}
            onSelectSlot={handleSelectSlot}
          />
        </aside>

        {/* Center: parking map */}
        <main className="flex-1 overflow-auto p-4">
          <ParkingMap
            slotMap={slotMap}
            status={status}
            recommendations={recommendations}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSelectSlot}
            frameUrl={frameUrl}
          />
        </main>

        {/* Right sidebar: slot detail (only when a slot is selected) */}
        {selectedSlot && (
          <SlotDetailSidebar
            slot={selectedSlot}
            status={status}
            slotMap={slotMap}
            predictions={predictions}
            onClose={() => setSelectedSlot(null)}
          />
        )}

      </div>

      {/* Footer */}
      <footer className="px-5 py-2 bg-zinc-900 border-t border-zinc-700 text-[10px] text-zinc-600 font-mono flex justify-between">
        <span>SIMATS Engineering — Computer Vision Capstone</span>
        <span>Auto-refresh every {POLL_INTERVAL / 1000}s</span>
      </footer>

    </div>
  );
}
