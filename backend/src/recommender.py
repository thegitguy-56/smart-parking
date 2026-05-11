# backend/src/recommender.py

"""
recommender.py — slot scoring and top-N recommendation

Formula (lower is better):
    score = (0.4 × norm_distance) - (0.6 × vacancy_prob)

    norm_distance : Euclidean distance from entry point to slot centroid,
                    normalised to [0, 1] across all slots so that distance
                    and vacancy_prob live on the same scale.
    vacancy_prob  : Prophet forecast — probability the slot is free at the
                    requested horizon (0 = certainly occupied, 1 = certainly free).

Only slots whose latest observed status is 'empty' are considered.
If Prophet models are unavailable the recommender falls back to distance-only
ranking (vacancy_prob = 1.0 for all empty slots).

Public interface used by api/main.py:
    from src.recommender import Recommender
    rec = Recommender()
    recs = rec.recommend(entry_x=0, entry_y=0, horizon_minutes=30, top_n=3)
"""

import json
import math
from pathlib import Path

from src.database import get_connection, get_latest_predictions

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR      = Path(__file__).resolve().parent.parent
SLOT_MAP_PATH = BASE_DIR / "data" / "raw" / "slot_map.json"


def _load_centroids() -> dict[str, tuple[float, float]]:
    """
    Returns {slot_id: (cx, cy)} for every slot in slot_map.json.
    slot_id is zero-padded to match the format used by the detector
    (integer 1 → "slot_001").
    """
    with open(SLOT_MAP_PATH, "r") as f:
        raw = json.load(f)

    centroids = {}
    for s in raw["slots"]:
        slot_id = f"slot_{s['slot_id']:03d}"
        centroids[slot_id] = (float(s["cx"]), float(s["cy"]))
    return centroids


def _get_current_empty_slots() -> set[str]:
    """
    Return the set of slot_ids whose most recent logged status is 'empty'.
    """
    conn = get_connection()
    rows = conn.execute("""
        SELECT ol.slot_id
        FROM   occupancy_log ol
        INNER JOIN (
            SELECT slot_id, MAX(logged_at) AS max_ts
            FROM   occupancy_log
            GROUP  BY slot_id
        ) latest ON ol.slot_id   = latest.slot_id
                 AND ol.logged_at = latest.max_ts
        WHERE ol.status = 'empty'
    """).fetchall()
    conn.close()
    return {r["slot_id"] for r in rows}


def _euclidean(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _normalise(values: list[float]) -> list[float]:
    """Min-max normalise a list to [0, 1]. Returns [0.5, ...] if all equal."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return [0.5] * len(values)
    return [(v - lo) / (hi - lo) for v in values]


# ---------------------------------------------------------------------------
# Recommender class
# ---------------------------------------------------------------------------

class Recommender:
    """
    Loads slot centroids once at construction time.
    Call .recommend(...) for each API request.
    """

    def __init__(self):
        self.centroids = _load_centroids()
        print(f"[Recommender] {len(self.centroids)} slot centroids loaded.")

    def recommend(
        self,
        entry_x: float = 0.0,
        entry_y: float = 0.0,
        horizon_minutes: int = 30,
        top_n: int = 3,
    ) -> list[dict]:
        """
        Score every currently-empty slot and return the top_n lowest scorers.

        Parameters
        ----------
        entry_x, entry_y    : driver's entry point in image-pixel coordinates.
                              Defaults to (0, 0) — top-left corner — if the
                              frontend does not supply a position.
        horizon_minutes     : forecast horizon passed to Prophet predictions.
        top_n               : number of recommendations to return.

        Returns
        -------
        list of dicts (sorted best-first):
        [
          {
            "slot_id":      "slot_042",
            "score":        -0.381,
            "distance":     124.7,
            "vacancy_prob": 0.88,
            "cx":           312.0,
            "cy":           205.5,
          },
          ...
        ]
        """
        # 1. Candidate pool: only slots currently observed as empty
        empty_slots = _get_current_empty_slots()
        if not empty_slots:
            return []

        candidates = [sid for sid in empty_slots if sid in self.centroids]
        if not candidates:
            return []

        # 2. Raw distances from entry point to each candidate centroid
        raw_distances = [
            _euclidean(entry_x, entry_y, self.centroids[sid][0], self.centroids[sid][1])
            for sid in candidates
        ]

        # 3. Normalise distances to [0, 1]
        norm_distances = _normalise(raw_distances)

        # 4. Vacancy probabilities from Prophet predictions table.
        #    Falls back to 1.0 (assume free) if no forecast exists for a slot.
        prediction_rows = get_latest_predictions(horizon_minutes)
        vacancy_map = {r["slot_id"]: r["vacancy_prob"] for r in prediction_rows}

        # 5. Score every candidate
        scored = []
        for i, slot_id in enumerate(candidates):
            norm_dist    = norm_distances[i]
            raw_dist     = raw_distances[i]
            vacancy_prob = vacancy_map.get(slot_id, 1.0)

            score = (0.4 * norm_dist) - (0.6 * vacancy_prob)

            scored.append({
                "slot_id":      slot_id,
                "score":        round(score, 4),
                "distance":     round(raw_dist, 2),
                "vacancy_prob": round(vacancy_prob, 4),
                "cx":           self.centroids[slot_id][0],
                "cy":           self.centroids[slot_id][1],
            })

        # 6. Sort ascending (lower score = better) and return top_n
        scored.sort(key=lambda x: x["score"])
        return scored[:top_n]


# ---------------------------------------------------------------------------
# Quick smoke-test:  python -m src.recommender
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import pprint
    rec = Recommender()

    print("\n--- Recommendations from entry point (0, 0), horizon 30 min ---")
    results = rec.recommend(entry_x=0, entry_y=0, horizon_minutes=30, top_n=3)
    pprint.pprint(results)

    print("\n--- Recommendations from centre of image (400, 300) ---")
    results = rec.recommend(entry_x=400, entry_y=300, horizon_minutes=30, top_n=3)
    pprint.pprint(results)