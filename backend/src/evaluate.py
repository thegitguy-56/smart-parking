import json
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")          # no display needed on Windows server / CI
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
)

# ---------------------------------------------------------------------------
# Paths  (all relative to this file's location: backend/src/)
# ---------------------------------------------------------------------------
BASE_DIR      = Path(__file__).resolve().parent.parent          # backend/
MODEL_PATH    = BASE_DIR / "models" / "slot_classifier.pth"
TEST_DIR      = BASE_DIR / "data" / "raw" / "test"
COCO_JSON     = TEST_DIR / "_annotations.coco.json"
EVAL_DIR      = BASE_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)

DEVICE        = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE      = 224
BATCH_SIZE    = 64                                              # adjust if VRAM is tight

# Category name that signals an occupied slot in the PKLot COCO export.
# Everything else (space-empty, spaces) is treated as empty (label 0).
OCCUPIED_NAME = "space-occupied"

# ---------------------------------------------------------------------------
# Transform  (must match training exactly)
# ---------------------------------------------------------------------------
val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ---------------------------------------------------------------------------
# Load model
# ---------------------------------------------------------------------------
def load_model(path: Path) -> nn.Module:
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(model.last_channel, 2)
    checkpoint = torch.load(path, map_location=DEVICE)

    # Support all common checkpoint formats
    if isinstance(checkpoint, dict):
        if "model_state" in checkpoint:
            state = checkpoint["model_state"]        # your train_classifier.py format
        elif "model_state_dict" in checkpoint:
            state = checkpoint["model_state_dict"]
        elif "state_dict" in checkpoint:
            state = checkpoint["state_dict"]
        else:
            state = checkpoint                       # bare state_dict
    else:
        state = checkpoint

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model

# ---------------------------------------------------------------------------
# Parse COCO annotations
# ---------------------------------------------------------------------------
def load_coco_annotations(coco_path: Path):
    """
    Returns two parallel lists:
        crops  : list of PIL.Image objects (one per annotation)
        labels : list of int (0 = empty, 1 = occupied)

    PKLot COCO bounding boxes are in [x, y, width, height] format.
    """
    with open(coco_path, "r") as f:
        coco = json.load(f)

    # Build lookup tables
    id_to_filename = {img["id"]: img["file_name"] for img in coco["images"]}
    id_to_catname  = {cat["id"]: cat["name"]      for cat in coco["categories"]}

    crops  = []
    labels = []
    missing = 0

    for ann in coco["annotations"]:
        img_path = TEST_DIR / id_to_filename[ann["image_id"]]
        if not img_path.exists():
            missing += 1
            continue

        x, y, w, h = ann["bbox"]
        # Guard against degenerate boxes
        if w < 2 or h < 2:
            continue

        with Image.open(img_path).convert("RGB") as img:
            # PIL crop expects (left, upper, right, lower)
            crop = img.crop((x, y, x + w, y + h))

        cat_name = id_to_catname[ann["category_id"]]
        label    = 1 if cat_name == OCCUPIED_NAME else 0

        crops.append(crop)
        labels.append(label)

    if missing:
        print(f"Warning: {missing} annotation(s) skipped — image file not found.")

    return crops, labels

# ---------------------------------------------------------------------------
# Run inference in batches
# ---------------------------------------------------------------------------
def predict_all(model: nn.Module, crops: list, transform) -> list:
    """Returns a list of predicted class indices (0 or 1)."""
    preds = []

    for start in range(0, len(crops), BATCH_SIZE):
        batch_pil = crops[start : start + BATCH_SIZE]
        tensors   = torch.stack([transform(c) for c in batch_pil]).to(DEVICE)

        with torch.no_grad():
            logits = model(tensors)           # (B, 2)
            pred   = logits.argmax(dim=1)     # (B,)

        preds.extend(pred.cpu().tolist())

        done = min(start + BATCH_SIZE, len(crops))
        print(f"  Processed {done}/{len(crops)} crops ...", end="\r")

    print()   # newline after the progress line
    return preds

# ---------------------------------------------------------------------------
# Save confusion matrix
# ---------------------------------------------------------------------------
def save_confusion_matrix(y_true: list, y_pred: list, out_dir: Path):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Empty (0)", "Occupied (1)"],
    )

    fig, ax = plt.subplots(figsize=(6, 5))
    disp.plot(ax=ax, colorbar=True, cmap="Blues")
    ax.set_title("MobileNetV2 — Test Set Confusion Matrix")
    plt.tight_layout()

    save_path = out_dir / "confusion_matrix.png"
    plt.savefig(save_path, dpi=150)
    plt.close(fig)
    print(f"Confusion matrix saved to: {save_path}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # Sanity checks
    if not MODEL_PATH.exists():
        sys.exit(f"Model not found: {MODEL_PATH}")
    if not COCO_JSON.exists():
        sys.exit(f"COCO annotation file not found: {COCO_JSON}")

    print(f"Device      : {DEVICE}")
    print(f"Model       : {MODEL_PATH}")
    print(f"Test split  : {COCO_JSON}")
    print()

    # 1. Load model
    print("Loading model ...")
    model = load_model(MODEL_PATH)

    # 2. Parse test annotations
    print("Parsing COCO annotations and cropping slots ...")
    crops, y_true = load_coco_annotations(COCO_JSON)
    print(f"Total test samples : {len(crops)}")
    print(f"  Occupied (1)     : {sum(y_true)}")
    print(f"  Empty    (0)     : {len(y_true) - sum(y_true)}")
    print()

    if len(crops) == 0:
        sys.exit("No test samples found. Check TEST_DIR and COCO_JSON paths.")

    # 3. Inference
    print("Running inference ...")
    y_pred = predict_all(model, crops, val_transform)

    # 4. Metrics
    acc = accuracy_score(y_true, y_pred)
    report = classification_report(
        y_true, y_pred,
        target_names=["Empty (0)", "Occupied (1)"],
        digits=4,
    )

    print("=" * 55)
    print("TEST SET RESULTS")
    print("=" * 55)
    print(f"Accuracy  : {acc:.4f}  ({acc * 100:.2f} %)")
    print()
    print(report)

    # 5. Confusion matrix PNG
    save_confusion_matrix(y_true, y_pred, EVAL_DIR)

    # 6. Also write a text summary so you can include it in your report
    summary_path = EVAL_DIR / "evaluation_summary.txt"
    with open(summary_path, "w") as f:
        f.write("TEST SET RESULTS\n")
        f.write("=" * 55 + "\n")
        f.write(f"Accuracy : {acc:.4f}  ({acc * 100:.2f} %)\n\n")
        f.write(report)
    print(f"Text summary saved to: {summary_path}")


if __name__ == "__main__":
    main()