// api.js
// All communication with the FastAPI backend lives here.
// Change BASE_URL to your Render deployment URL before deploying to Vercel.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * GET /status
 * Returns:
 *   {
 *     slots: { "slot_id": { occupied: bool, confidence: float } },
 *     total: int,
 *     occupied: int,
 *     free: int
 *   }
 */
export async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  if (!res.ok) throw new Error(`/status failed: ${res.status}`);
  return res.json();
}

/**
 * GET /frame
 * Returns a JPEG blob — annotated parking lot image.
 * We return an object-URL string so an <img> can display it directly.
 */
export async function fetchFrame() {
  const res = await fetch(`${BASE_URL}/frame`);
  if (!res.ok) throw new Error(`/frame failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * GET /predict?horizon=<minutes>
 * Returns:
 *   {
 *     "slot_id": [
 *       { ds: "2024-...", vacancy_prob: float },
 *       ...
 *     ]
 *   }
 */
export async function fetchPredictions(horizon = 30) {
  const res = await fetch(`${BASE_URL}/predict?horizon=${horizon}`);
  if (!res.ok) throw new Error(`/predict failed: ${res.status}`);
  return res.json();
}

/**
 * GET /recommend?entry_x=&entry_y=&horizon=&top_n=3
 * Returns:
 *   [
 *     { slot_id: str, score: float, distance: float, vacancy_prob: float },
 *     ...
 *   ]
 */
export async function fetchRecommendations(entryX = 0, entryY = 0, horizon = 30, topN = 3) {
  const params = new URLSearchParams({
    entry_x: entryX,
    entry_y: entryY,
    horizon,
    top_n: topN,
  });
  const res = await fetch(`${BASE_URL}/recommend?${params}`);
  if (!res.ok) throw new Error(`/recommend failed: ${res.status}`);
  return res.json();
}

/**
 * GET /history
 * Returns array of occupancy log rows:
 *   [{ timestamp: str, slot_id: str, occupied: int }, ...]
 */
export async function fetchHistory() {
  const res = await fetch(`${BASE_URL}/history`);
  if (!res.ok) throw new Error(`/history failed: ${res.status}`);
  return res.json();
}

/**
 * GET /slots
 * Returns slot map:
 *   { "slot_id": { bbox: [x,y,w,h], centroid: [cx,cy] } }
 */
export async function fetchSlots() {
  const res = await fetch(`${BASE_URL}/slots`);
  if (!res.ok) throw new Error(`/slots failed: ${res.status}`);
  return res.json();
}
