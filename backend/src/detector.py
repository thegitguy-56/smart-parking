"""
detector.py — per-frame slot occupancy inference

Public interface used by api/main.py:

    from src.detector import Detector

    det = Detector()                          # loads model + slot map once
    result = det.run(image_path)              # returns occupancy dict + saves frame
    # result = {
    #   "slot_001": {"status": "occupied", "confidence": 0.97},
    #   "slot_002": {"status": "empty",    "confidence": 0.88},
    #   ...
    # }
"""

import json
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from src.database import init_db, log_occupancy

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR       = Path(__file__).resolve().parent.parent          # backend/
MODEL_PATH     = BASE_DIR / "models" / "slot_classifier.pth"
SLOT_MAP_PATH  = BASE_DIR / "data"   / "raw" / "slot_map.json"
FRAME_OUT_PATH = BASE_DIR / "data"   / "annotated_frame.jpg"

DEVICE    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE  = 224
BATCH_SIZE = 64

# Colours for bounding boxes drawn on the annotated frame (BGR for OpenCV)
COLOR_OCCUPIED = (0,   0,   255)   # red
COLOR_EMPTY    = (0,   200,  0)    # green
BOX_THICKNESS  = 2

# ---------------------------------------------------------------------------
# Transform  (identical to training and evaluation)
# ---------------------------------------------------------------------------
_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def _build_model() -> nn.Module:
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(model.last_channel, 2)
    return model


def _load_weights(model: nn.Module, path: Path) -> nn.Module:
    checkpoint = torch.load(path, map_location=DEVICE, weights_only=False)
    if isinstance(checkpoint, dict):
        if "model_state" in checkpoint:
            state = checkpoint["model_state"]
        elif "model_state_dict" in checkpoint:
            state = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state = checkpoint["state_dict"]
        else:
            state = checkpoint
    else:
        state = checkpoint
    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model


# ---------------------------------------------------------------------------
# Detector class
# ---------------------------------------------------------------------------
class Detector:
    """
    Loads the model and slot map once at construction time.
    Call .run(image_path) for each new frame.
    """

    def __init__(self):
        init_db()   # ensure tables exist before any logging

        print(f"[Detector] Loading model from {MODEL_PATH} on {DEVICE} ...")
        self.model = _load_weights(_build_model(), MODEL_PATH)

        print(f"[Detector] Loading slot map from {SLOT_MAP_PATH} ...")
        with open(SLOT_MAP_PATH, "r") as f:
            raw = json.load(f)

        # slot_map.json structure:
        # {
        #   "reference_frame": "...",
        #   "total_slots": 100,
        #   "slots": [
        #     {"slot_id": 1, "x": 139, "y": 165, "w": 23, "h": 40, "cx": ..., "cy": ...},
        #     ...
        #   ]
        # }
        slot_list = raw["slots"]
        self.slots = [
            {
                "slot_id": f"slot_{s['slot_id']:03d}",   # 1 → "slot_001"
                "bbox":    [s["x"], s["y"], s["w"], s["h"]],
            }
            for s in slot_list
        ]

        print(f"[Detector] {len(self.slots)} slots loaded.")

    # -----------------------------------------------------------------------
    def run(self, image_path: str | Path) -> dict:
        """
        Run inference on one parking lot image.

        Parameters
        ----------
        image_path : path to a JPG/PNG image from the PKLot dataset

        Returns
        -------
        dict  {slot_id: {"status": "occupied"|"empty", "confidence": float}}
        """
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # --- Load image once (PIL for cropping, OpenCV copy for annotation) ---
        pil_img = Image.open(image_path).convert("RGB")
        cv_img  = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # --- Crop every slot ------------------------------------------------
        crops    = []
        slot_ids = []

        for slot in self.slots:
            slot_id = slot["slot_id"]
            x, y, w, h = [int(v) for v in slot["bbox"]]

            # Guard against out-of-bounds or degenerate boxes
            img_w, img_h = pil_img.size
            x  = max(0, min(x, img_w - 1))
            y  = max(0, min(y, img_h - 1))
            x2 = min(x + w, img_w)
            y2 = min(y + h, img_h)

            if (x2 - x) < 2 or (y2 - y) < 2:
                continue

            crop = pil_img.crop((x, y, x2, y2))
            crops.append(_transform(crop))
            slot_ids.append((slot_id, x, y, x2, y2))

        if not crops:
            raise RuntimeError("No valid crops produced — check slot_map.json bbox values.")

        # --- Batched inference ----------------------------------------------
        all_preds  = []
        all_probs  = []

        softmax = nn.Softmax(dim=1)

        for start in range(0, len(crops), BATCH_SIZE):
            batch   = torch.stack(crops[start : start + BATCH_SIZE]).to(DEVICE)
            with torch.no_grad():
                logits = self.model(batch)          # (B, 2)
                probs  = softmax(logits)            # (B, 2)
                preds  = logits.argmax(dim=1)       # (B,)

            all_preds.extend(preds.cpu().tolist())
            all_probs.extend(probs.cpu().tolist())

        # --- Build result dict + annotate image ----------------------------
        result   = {}
        db_rows  = []

        for i, (slot_id, x, y, x2, y2) in enumerate(slot_ids):
            pred       = all_preds[i]               # 0 = empty, 1 = occupied
            confidence = float(all_probs[i][pred])
            status     = "occupied" if pred == 1 else "empty"

            result[slot_id] = {"status": status, "confidence": confidence}
            db_rows.append({"slot_id": slot_id, "status": status, "confidence": confidence})

            # Draw bounding box on the OpenCV copy
            color = COLOR_OCCUPIED if pred == 1 else COLOR_EMPTY
            cv2.rectangle(cv_img, (x, y), (x2, y2), color, BOX_THICKNESS)

            # Small label (slot id + confidence) above each box
            label = f"{slot_id} {confidence:.2f}"
            cv2.putText(
                cv_img, label,
                (x, max(y - 4, 10)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.35, color, 1, cv2.LINE_AA,
            )

        # --- Save annotated frame ------------------------------------------
        FRAME_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(FRAME_OUT_PATH), cv_img)

        # --- Log to SQLite --------------------------------------------------
        log_occupancy(db_rows)

        return result


# ---------------------------------------------------------------------------
# Quick smoke-test:  python -m src.detector  (run from backend/)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys, pprint

    if len(sys.argv) < 2:
        print("Usage: python -m src.detector <path_to_image>")
        sys.exit(1)

    det    = Detector()
    result = det.run(sys.argv[1])

    occupied = sum(1 for v in result.values() if v["status"] == "occupied")
    empty    = len(result) - occupied

    print(f"\nSlots processed : {len(result)}")
    print(f"Occupied        : {occupied}")
    print(f"Empty           : {empty}")
    print(f"\nAnnotated frame : {FRAME_OUT_PATH}")
    print("\nFirst 5 results:")
    pprint.pprint(dict(list(result.items())[:5]))