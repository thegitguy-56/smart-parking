// App.jsx
// Root component. Holds all state, runs the polling loop, lays out components.
//
// Two fetch modes:
//   fetchAll(force=false) — normal poll, skips frame fetch if frame_index unchanged
//   fetchAll(force=true)  — triggered by Refresh Now button, always re-fetches frame

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

const POLL_INTERVAL = 5000;

export default function App() {
  // Control state
  const [horizon, setHorizon] = useState(30);
  const [entryX,  setEntryX]  = useState(0);
  const [entryY,  setEntryY]  = useState(0);

  // Data state
  const [status,          setStatus]         = useState(null);
  const [frameUrl,        setFrameUrl]        = useState(null);
  const [predictions,     setPredictions]     = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [slotMap,         setSlotMap]         = useState(null);

  // UI state
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Refs — don't cause re-renders when changed
  const lastFrameIndex  = useRef(-1);
  const prevFrameUrl    = useRef(null);
  const slotMapFetched  = useRef(false);

  // Helper: fetch and update the frame image
  async function refreshFrame() {
    const newFrameUrl = await fetchFrame();
    if (prevFrameUrl.current) URL.revokeObjectURL(prevFrameUrl.current);
    prevFrameUrl.current = newFrameUrl;
    setFrameUrl(newFrameUrl);
  }

  // Main fetch function.
  // force=true skips the frame_index check and re-fetches everything.
  const fetchAll = useCallback(async (force = false) => {
    try {
      setError(null);

      // Always fetch status
      const newStatus = await fetchStatus();
      setStatus(newStatus);

      // Fetch frame only if frame_index changed, or if forced
      const currentFrameIndex = newStatus._frameIndex ?? -1;
      if (force || currentFrameIndex !== lastFrameIndex.current) {
        lastFrameIndex.current = currentFrameIndex;
        await refreshFrame();
      }

      // Fetch slotMap only once (unless forced)
      if (force || !slotMapFetched.current) {
        const newSlotMap = await fetchSlots();
        setSlotMap(newSlotMap);
        slotMapFetched.current = true;
      }

      // Always fetch predictions and recommendations (they depend on horizon/entry)
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

  // Initial fetch on mount
  useEffect(() => {
    fetchAll(true); // force=true so everything loads fresh on first render
  }, [fetchAll]);

  // Polling — normal fetch every 5 seconds
  useEffect(() => {
    const id = setInterval(() => fetchAll(false), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Manual refresh handler — always force re-fetch everything
  function handleRefresh() {
    fetchAll(true);
  }

  function handleSelectSlot(slotId) {
    setSelectedSlot((prev) => (prev === slotId ? null : slotId));
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans">

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              loading ? "bg-zinc-600" : error ? "bg-red-500" : "bg-emerald-400 animate-pulse"
            }`}
          />
          {error ? "Connection error" : loading ? "Connecting..." : "Live"}
        </div>
      </header>

      <KPIStrip status={status} loading={loading} />

      {/* Pass handleRefresh (force=true) to the button */}
      <Controls
        horizon={horizon}    setHorizon={setHorizon}
        entryX={entryX}      setEntryX={setEntryX}
        entryY={entryY}      setEntryY={setEntryY}
        onRefresh={handleRefresh}
      />

      {error && (
        <div className="px-5 py-2 bg-red-950 border-b border-red-800 text-red-400 text-xs font-mono">
          Error: {error}. Check that the backend is running and VITE_API_URL is correct.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        <aside className="w-64 min-w-[240px] flex flex-col gap-4 p-4 bg-zinc-900 border-r border-zinc-700 overflow-y-auto">
          <SlotRecommendation
            recommendations={recommendations}
            loading={loading}
            onSelectSlot={handleSelectSlot}
          />
        </aside>

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

      <footer className="px-5 py-2 bg-zinc-900 border-t border-zinc-700 text-[10px] text-zinc-600 font-mono flex justify-between">
        <span>SIMATS Engineering — Computer Vision Capstone</span>
        <span>Auto-refresh every {POLL_INTERVAL / 1000}s</span>
      </footer>

    </div>
  );
}