// api.js
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Normalize /status response.
// Also passes through _frameIndex so App.jsx can avoid re-fetching the
// frame image when the video has not advanced.
function normalizeStatus(raw) {
  const total    = (raw.occupied ?? 0) + (raw.empty ?? 0);
  const occupied = raw.occupied ?? 0;
  const free     = raw.empty   ?? 0;

  const slots = {};
  for (const [id, val] of Object.entries(raw.slots ?? {})) {
    slots[id] = {
      occupied:   val.status === "occupied",
      confidence: val.confidence ?? 0,
    };
  }

  return {
    total,
    occupied,
    free,
    slots,
    _frameIndex: raw.frame_index ?? -1,   // used by App to skip redundant frame fetches
  };
}

// Normalize /slots response.
// Backend returns an array of { slot_id: int, x, y, w, h, cx, cy }.
// We convert to { "slot_001": { bbox: [x,y,w,h], centroid: [cx,cy] } }
// using zero-padded IDs to match /status keys.
function normalizeSlots(raw) {
  const result = {};
  for (const s of raw.slots ?? []) {
    const id = `slot_${String(s.slot_id).padStart(3, "0")}`;
    result[id] = {
      bbox:     [s.x, s.y, s.w, s.h],
      centroid: [s.cx, s.cy],
    };
  }
  return result;
}

// Normalize /predict response.
// Backend returns { forecasts: [ { slot_id, vacancy_prob } ] }.
// We convert to { "slot_001": 0.73, ... }.
function normalizeForecasts(raw) {
  const result = {};
  for (const f of raw.forecasts ?? []) {
    result[f.slot_id] = f.vacancy_prob;
  }
  return result;
}

// Normalize /recommend response.
// Backend returns { recommendations: [...] }.
function normalizeRecommendations(raw) {
  return raw.recommendations ?? raw;
}

// ─── Exported API functions ───────────────────────────────────────────────────

export async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  if (!res.ok) throw new Error(`/status failed: ${res.status}`);
  return normalizeStatus(await res.json());
}

export async function fetchFrame() {
  const res = await fetch(`${BASE_URL}/frame`);
  if (!res.ok) throw new Error(`/frame failed: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export async function fetchPredictions(horizon = 30) {
  const res = await fetch(`${BASE_URL}/predict?horizon=${horizon}`);
  if (!res.ok) throw new Error(`/predict failed: ${res.status}`);
  return normalizeForecasts(await res.json());
}

export async function fetchRecommendations(entryX = 0, entryY = 0, horizon = 30, topN = 3) {
  const params = new URLSearchParams({ entry_x: entryX, entry_y: entryY, horizon, top_n: topN });
  const res = await fetch(`${BASE_URL}/recommend?${params}`);
  if (!res.ok) throw new Error(`/recommend failed: ${res.status}`);
  return normalizeRecommendations(await res.json());
}

export async function fetchHistory(limit = 500, offset = 0) {
  const params = new URLSearchParams({ limit, offset });
  const res = await fetch(`${BASE_URL}/history?${params}`);
  if (!res.ok) throw new Error(`/history failed: ${res.status}`);
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${BASE_URL}/analytics`);
  if (!res.ok) throw new Error(`/analytics failed: ${res.status}`);
  return res.json();
}

export async function fetchSlots() {
  const res = await fetch(`${BASE_URL}/slots`);
  if (!res.ok) throw new Error(`/slots failed: ${res.status}`);
  return normalizeSlots(await res.json());
}