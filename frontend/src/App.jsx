// App.jsx
// Root component. Holds all state, runs the polling loop, lays out components.
//
// Changes vs original:
//   - fetchAnalytics wired in (fetched once on mount, re-fetched on force)
//   - OccupancyChart rendered below KPIStrip (always visible)
//   - entryX/entryY updated via map-click (onSetEntry) instead of raw inputs
//   - onResetEntry resets entry point to (0, 0)
//   - horizon prop forwarded to SlotDetailSidebar → PredictionChart
//   - Frame counter added to header
//   - Controls updated for new API (no setEntryX/setEntryY props)

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStatus,
  fetchFrame,
  fetchPredictions,
  fetchRecommendations,
  fetchSlots,
  fetchAnalytics,
} from "./api";

import KPIStrip           from "./components/KPIStrip";
import Controls           from "./components/Controls";
import OccupancyChart     from "./components/OccupancyChart";
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
  const [analytics,       setAnalytics]       = useState(null);

  // UI state
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Refs — don't cause re-renders when changed
  const lastFrameIndex = useRef(-1);
  const prevFrameUrl   = useRef(null);
  const slotMapFetched = useRef(false);
  const analyticsDone  = useRef(false);

  // Helper: fetch and update the frame image
  async function refreshFrame() {
    const newFrameUrl = await fetchFrame();
    if (prevFrameUrl.current) URL.revokeObjectURL(prevFrameUrl.current);
    prevFrameUrl.current = newFrameUrl;
    setFrameUrl(newFrameUrl);
  }

  // Main fetch function.
  const fetchAll = useCallback(async (force = false) => {
    try {
      setError(null);

      // Always fetch status
      const newStatus = await fetchStatus();
      setStatus(newStatus);

      // Fetch frame only if frame_index changed or forced
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

      // Fetch analytics once on mount (or force)
      if (force || !analyticsDone.current) {
        fetchAnalytics()
          .then(setAnalytics)
          .catch(() => {}); // non-critical: backend may not have enough data yet
        analyticsDone.current = true;
      }

      // Always fetch predictions and recommendations (depend on horizon/entry)
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
    fetchAll(true);
  }, [fetchAll]);

  // Polling — normal fetch every 5 seconds
  useEffect(() => {
    const id = setInterval(() => fetchAll(false), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Manual refresh
  function handleRefresh() {
    analyticsDone.current = false; // re-fetch analytics on manual refresh
    fetchAll(true);
  }

  // Map click sets entry point
  function handleSetEntry(x, y) {
    setEntryX(x);
    setEntryY(y);
  }

  function handleResetEntry() {
    setEntryX(0);
    setEntryY(0);
  }

  function handleSelectSlot(slotId) {
    setSelectedSlot((prev) => (prev === slotId ? null : slotId));
  }

  // Frame counter display
  const frameDisplay = status
    ? `Frame ${status._frameIndex ?? "—"}`
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          {/* Grid icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-sky-400">
            <rect x="1" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="12" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="1" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="12" y="12" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="font-mono text-sm font-bold tracking-widest text-zinc-100 uppercase">
            Smart Parking
          </span>
          {frameDisplay && (
            <span className="text-[10px] font-mono text-zinc-600 hidden sm:block">
              / {frameDisplay}
            </span>
          )}
        </div>

        {/* Right: live indicator + clock */}
        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
          <LiveClock />
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                loading ? "bg-zinc-600" :
                error   ? "bg-red-500"  :
                "bg-emerald-400 animate-pulse"
              }`}
            />
            <span>
              {error ? "Connection error" : loading ? "Connecting…" : "Live"}
            </span>
          </div>
        </div>
      </header>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <KPIStrip status={status} loading={loading} />

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <Controls
        horizon={horizon}   setHorizon={setHorizon}
        entryX={entryX}     entryY={entryY}
        onResetEntry={handleResetEntry}
        onRefresh={handleRefresh}
      />

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="px-5 py-2 bg-red-950 border-b border-red-800 text-red-400 text-xs font-mono">
          Error: {error}. Check that the backend is running and VITE_API_URL is correct.
        </div>
      )}

      {/* ── Occupancy Trend Chart ───────────────────────────────────────── */}
      <div className="px-4 pt-3">
        <OccupancyChart status={status} analytics={analytics} />
      </div>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left sidebar — recommendations */}
        <aside className="w-72 min-w-[280px] flex flex-col gap-4 p-4 bg-zinc-900 border-r border-zinc-700 overflow-y-auto">
          <SlotRecommendation
            recommendations={recommendations}
            loading={loading}
            onSelectSlot={handleSelectSlot}
          />

          {/* Analytics stats card (if available) */}
          {analytics && (
            <div className="mt-2 rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-2">
                Lot Statistics
              </p>
              <div className="flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Total readings</span>
                  <span className="text-zinc-300">{analytics.total_readings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Avg occupancy</span>
                  <span className="text-amber-400">{analytics.avg_occupancy_pct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Peak hour</span>
                  <span className="text-sky-400">{String(analytics.peak_hour).padStart(2, "0")}:00</span>
                </div>
                {analytics.busiest_slot && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Busiest slot</span>
                    <span className="text-emerald-400">{analytics.busiest_slot}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Main — parking map */}
        <main className="flex-1 overflow-auto p-4">
          <ParkingMap
            slotMap={slotMap}
            status={status}
            recommendations={recommendations}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSelectSlot}
            frameUrl={frameUrl}
            entryX={entryX}
            entryY={entryY}
            onSetEntry={handleSetEntry}
          />
        </main>

        {/* Right sidebar — slot detail (conditional) */}
        {selectedSlot && (
          <SlotDetailSidebar
            slot={selectedSlot}
            status={status}
            slotMap={slotMap}
            predictions={predictions}
            horizon={horizon}
            onClose={() => setSelectedSlot(null)}
          />
        )}

      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-5 py-2 bg-zinc-900 border-t border-zinc-700 text-[10px] text-zinc-600 font-mono flex justify-between">
        <span>SIMATS Engineering — Computer Vision Capstone</span>
        <span>Auto-refresh every {POLL_INTERVAL / 1000}s</span>
      </footer>

    </div>
  );
}

// Small clock component — re-renders every second
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="hidden md:block tabular-nums">
      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}