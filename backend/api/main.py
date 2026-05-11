# backend/api/main.py

"""
FastAPI backend for the Smart Parking System.

Endpoints
---------
GET /status          current occupancy of all slots
GET /frame           latest annotated frame as a JPEG image
GET /predict         Prophet vacancy forecast per slot
GET /recommend       top-3 scored slot recommendations
GET /history         full occupancy log (for charts)
GET /slots           slot map coordinates (for canvas overlay)
"""

import json
import os
import requests
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from src.database import get_full_history, get_latest_occupancy, init_db
from src.detector import Detector
from src.predictor import Predictor
from src.recommender import Recommender

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR       = Path(__file__).resolve().parent.parent
SLOT_MAP_PATH  = BASE_DIR / "data" / "raw" / "slot_map.json"
FRAME_PATH     = BASE_DIR / "data" / "annotated_frame.jpg"
IMAGE_DIR      = BASE_DIR / "data" / "raw" / "test"   # folder of PKLot images
MODEL_DOWNLOAD_URL = "https://huggingface.co/rohanv56/smart-parking-detector/resolve/main/slot_classifier.pth"

# ---------------------------------------------------------------------------
# Shared state — loaded once at startup, reused across requests
# ---------------------------------------------------------------------------
_detector:   Detector   | None = None
_predictor:  Predictor  | None = None
_recommender: Recommender | None = None

# Index into the sorted image list so each /status call advances one frame
_image_list:  list[Path] = []
_frame_index: int        = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy objects once when the server starts."""
    global _detector, _predictor, _recommender, _image_list

    # Ensure model file exists before initializing detector
    model_path = BASE_DIR / "models" / "slot_classifier.pth"
    ensure_model_exists(model_path)

    init_db()

    _detector    = Detector()
    _predictor   = Predictor()
    _recommender = Recommender()

    # Build a sorted list of all test images to simulate a video stream
    _image_list = sorted(IMAGE_DIR.glob("*.jpg"))
    if not _image_list:
        print(f"[WARNING] No .jpg images found in {IMAGE_DIR}")

    print(f"[API] Ready. {len(_image_list)} frames available.")
    yield
    # Nothing to clean up


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Smart Parking API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your Vercel URL after deploy
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependency guard
# ---------------------------------------------------------------------------
def _require(obj, name: str):
    if obj is None:
        raise HTTPException(status_code=503, detail=f"{name} not initialised.")
    return obj


# ---------------------------------------------------------------------------
# GET /status
# ---------------------------------------------------------------------------
@app.get("/status")
def get_status():
    """
    Run the detector on the next frame in the image sequence and return
    the current occupancy of all slots.

    Response shape:
    {
      "frame_index": 5,
      "total_frames": 300,
      "occupied": 74,
      "empty": 26,
      "slots": {
        "slot_001": {"status": "occupied", "confidence": 0.97},
        ...
      }
    }
    """
    global _frame_index

    det = _require(_detector, "Detector")

    if not _image_list:
        raise HTTPException(status_code=404, detail="No images found in test directory.")

    # Advance frame (loop back to start when the sequence ends)
    img_path     = _image_list[_frame_index % len(_image_list)]
    _frame_index = (_frame_index + 1) % len(_image_list)

    result = det.run(img_path)

    occupied = sum(1 for v in result.values() if v["status"] == "occupied")
    empty    = len(result) - occupied

    return {
        "frame_index":  _frame_index,
        "total_frames": len(_image_list),
        "occupied":     occupied,
        "empty":        empty,
        "slots":        result,
    }


# ---------------------------------------------------------------------------
# GET /frame
# ---------------------------------------------------------------------------
@app.get("/frame")
def get_frame():
    """
    Return the annotated JPEG produced by the most recent /status call.
    The frontend polls this to display the live parking lot view.
    """
    if not FRAME_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No annotated frame yet. Call /status first.",
        )
    return FileResponse(
        path=str(FRAME_PATH),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},   # prevent browser caching stale frames
    )


# ---------------------------------------------------------------------------
# GET /predict
# ---------------------------------------------------------------------------
@app.get("/predict")
def get_predict(horizon: int = Query(default=30, ge=1, le=1440)):
    """
    Return Prophet vacancy forecasts for all slots.

    Query param:
        horizon (int, minutes, default 30, max 1440)

    Response shape:
    {
      "horizon_minutes": 30,
      "forecasts": [
        {"slot_id": "slot_001", "vacancy_prob": 0.72},
        ...
      ]
    }
    """
    pred = _require(_predictor, "Predictor")
    forecasts = pred.predict(horizon_minutes=horizon)
    return {"horizon_minutes": horizon, "forecasts": forecasts}


# ---------------------------------------------------------------------------
# GET /recommend
# ---------------------------------------------------------------------------
@app.get("/recommend")
def get_recommend(
    entry_x: float = Query(default=0.0),
    entry_y: float = Query(default=0.0),
    horizon: int   = Query(default=30, ge=1, le=1440),
    top_n:   int   = Query(default=3,  ge=1, le=10),
):
    """
    Return the top-N recommended slots scored by distance + vacancy.

    Query params:
        entry_x, entry_y  driver entry point in image-pixel coordinates
        horizon           forecast horizon in minutes
        top_n             number of results (default 3)

    Response shape:
    {
      "recommendations": [
        {
          "slot_id":      "slot_042",
          "score":        -0.381,
          "distance":     124.7,
          "vacancy_prob": 0.88,
          "cx":           312.0,
          "cy":           205.5
        },
        ...
      ]
    }
    """
    rec = _require(_recommender, "Recommender")
    recommendations = rec.recommend(
        entry_x=entry_x,
        entry_y=entry_y,
        horizon_minutes=horizon,
        top_n=top_n,
    )
    return {"recommendations": recommendations}


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------
@app.get("/history")
def get_history():
    """
    Return the full occupancy log for charting.

    Response shape:
    {
      "count": 70000,
      "records": [
        {"slot_id": "slot_001", "status": "occupied",
         "confidence": 0.97, "logged_at": "2024-01-01T10:00:00+00:00"},
        ...
      ]
    }
    """
    records = get_full_history()
    return {"count": len(records), "records": records}


# ---------------------------------------------------------------------------
# GET /slots
# ---------------------------------------------------------------------------
@app.get("/slots")
def get_slots():
    """
    Return the slot map (coordinates + centroids) for the frontend canvas.

    Response shape:
    {
      "reference_frame": "...",
      "total_slots": 100,
      "slots": [
        {"slot_id": 1, "x": 139, "y": 165, "w": 23, "h": 40,
         "cx": 150.5, "cy": 185.0},
        ...
      ]
    }
    """
    if not SLOT_MAP_PATH.exists():
        raise HTTPException(status_code=404, detail="slot_map.json not found.")
    with open(SLOT_MAP_PATH, "r") as f:
        data = json.load(f)
    return data

# ---------------------------------------------------------------------------
# Model download
# ---------------------------------------------------------------------------
def ensure_model_exists(model_path: Path) -> None:
    """Download model from GitHub Releases if it doesn't exist."""
    if model_path.exists():
        return
    
    print(f"[Model] Downloading from {MODEL_DOWNLOAD_URL}...")
    model_path.parent.mkdir(parents=True, exist_ok=True)
    
    response = requests.get(MODEL_DOWNLOAD_URL, timeout=300)
    response.raise_for_status()
    
    with open(model_path, 'wb') as f:
        f.write(response.content)
    print("[Model] Download complete ✓")