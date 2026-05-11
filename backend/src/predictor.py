# backend/src/predictor.py

"""
predictor.py — per-slot vacancy forecasting with Facebook Prophet

Training (run once after detector has populated occupancy_log):
    python -m src.predictor train

Runtime (called by api/main.py):
    from src.predictor import Predictor
    p = Predictor()
    forecasts = p.predict(horizon_minutes=30)
    # forecasts = [{"slot_id": "slot_001", "vacancy_prob": 0.72}, ...]
"""

import json
import pickle
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
from prophet import Prophet

from src.database import get_connection, save_predictions

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR        = Path(__file__).resolve().parent.parent
MODELS_DIR      = BASE_DIR / "models" / "prophet_models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _model_path(slot_id: str) -> Path:
    return MODELS_DIR / f"{slot_id}.pkl"


def _load_occupancy_series(slot_id: str) -> pd.DataFrame:
    """
    Pull occupancy_log rows for one slot and return a Prophet-ready DataFrame
    with columns [ds, y] where y = 1 means vacant (empty), 0 means occupied.

    Prophet predicts the vacancy signal so that higher values mean
    more likely to be free — which is what the recommender needs.
    """
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT logged_at, status
        FROM   occupancy_log
        WHERE  slot_id = ?
        ORDER  BY logged_at
        """,
        (slot_id,),
    ).fetchall()
    conn.close()

    if not rows:
        return pd.DataFrame(columns=["ds", "y"])

    records = []
    for row in rows:
        ts     = pd.to_datetime(row["logged_at"], utc=True).tz_localize(None)
        vacant = 1 if row["status"] == "empty" else 0
        records.append({"ds": ts, "y": vacant})

    return pd.DataFrame(records)


def _get_all_slot_ids() -> list[str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT slot_id FROM occupancy_log ORDER BY slot_id"
    ).fetchall()
    conn.close()
    return [r["slot_id"] for r in rows]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_all(min_rows: int = 10) -> None:
    """
    Fit one Prophet model per slot and save to models/prophet_models/.

    Slots with fewer than min_rows observations are skipped — Prophet
    cannot fit a meaningful trend on very short series.
    """
    slot_ids = _get_all_slot_ids()

    if not slot_ids:
        print("No data in occupancy_log. Run the detector first.")
        return

    print(f"Training Prophet models for {len(slot_ids)} slots ...")
    skipped  = 0
    trained  = 0

    for i, slot_id in enumerate(slot_ids, 1):
        df = _load_occupancy_series(slot_id)

        if len(df) < min_rows:
            skipped += 1
            continue

        # Prophet configuration:
        #   - daily_seasonality captures morning/evening patterns
        #   - weekly_seasonality captures weekday vs weekend
        #   - yearly_seasonality off — PKLot data spans only a few months
        #   - interval_width sets the uncertainty interval (not used for point
        #     estimates, but kept at default 0.80)
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,
            changepoint_prior_scale=0.05,   # conservative — avoids overfitting
            interval_width=0.80,
        )

        # Suppress Prophet's verbose Stan output
        import logging
        logging.getLogger("prophet").setLevel(logging.WARNING)
        logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

        model.fit(df)

        with open(_model_path(slot_id), "wb") as f:
            pickle.dump(model, f)

        trained += 1
        print(f"  [{i}/{len(slot_ids)}] {slot_id} — {len(df)} observations  OK")

    print(f"\nDone. Trained: {trained}  |  Skipped (too few rows): {skipped}")
    print(f"Models saved to: {MODELS_DIR}")


# ---------------------------------------------------------------------------
# Predictor class  (used by the API at runtime)
# ---------------------------------------------------------------------------

class Predictor:
    """
    Loads serialized Prophet models from disk once.
    Call .predict(horizon_minutes) to get forecasts for all slots.
    """

    def __init__(self):
        pkl_files = sorted(MODELS_DIR.glob("*.pkl"))
        if not pkl_files:
            raise RuntimeError(
                f"No Prophet models found in {MODELS_DIR}. "
                "Run:  python -m src.predictor train"
            )

        self.models: dict[str, Prophet] = {}
        for path in pkl_files:
            slot_id = path.stem          # filename without .pkl
            with open(path, "rb") as f:
                self.models[slot_id] = pickle.load(f)

        print(f"[Predictor] {len(self.models)} Prophet models loaded.")

    def predict(self, horizon_minutes: int = 30) -> list[dict]:
        """
        Forecast vacancy probability for every slot at now + horizon_minutes.

        Returns
        -------
        list of dicts:
            [{"slot_id": "slot_001", "vacancy_prob": 0.72}, ...]

        vacancy_prob is clipped to [0, 1].  It represents the probability
        that the slot will be free at the forecast horizon.
        """
        future_time = datetime.now(timezone.utc) + timedelta(minutes=horizon_minutes)
        future_time = future_time.replace(tzinfo=None)   # Prophet expects tz-naive

        results = []

        for slot_id, model in self.models.items():
            future_df = pd.DataFrame({"ds": [future_time]})
            forecast  = model.predict(future_df)

            # yhat is the predicted vacancy signal (0–1 trained range).
            # Clip so that noise does not push it outside [0, 1].
            yhat         = float(forecast["yhat"].iloc[0])
            vacancy_prob = float(np.clip(yhat, 0.0, 1.0))

            results.append({
                "slot_id":      slot_id,
                "vacancy_prob": vacancy_prob,
            })

        # Persist to DB so /predict endpoint can also serve cached results
        save_predictions([
            {**r, "horizon_minutes": horizon_minutes}
            for r in results
        ])

        return sorted(results, key=lambda x: x["slot_id"])


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] != "train":
        print("Usage: python -m src.predictor train")
        sys.exit(1)

    train_all()