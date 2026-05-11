import json
import os
from pathlib import Path
from PIL import Image

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR     = Path(__file__).resolve().parents[1]
RAW_DIR      = BASE_DIR / "data" / "raw"
CROPS_DIR    = BASE_DIR / "data" / "crops"
OCCUPIED_DIR = CROPS_DIR / "occupied"
EMPTY_DIR    = CROPS_DIR / "empty"

SPLITS = ["train", "valid", "test"]

# Max crops per class — more than enough for MobileNetV2
MAX_PER_CLASS = 4000

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_coco(path: Path) -> dict:
    with open(path, "r") as f:
        return json.load(f)

def get_category_map(coco: dict) -> dict:
    cat_map = {}
    for c in coco["categories"]:
        if c["name"] == "space-occupied":
            cat_map[c["id"]] = "occupied"
        elif c["name"] == "space-empty":
            cat_map[c["id"]] = "empty"
    return cat_map

def get_image_map(coco: dict, split_dir: Path) -> dict:
    return {
        img["id"]: split_dir / img["file_name"]
        for img in coco["images"]
    }

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
def process_split(split: str, counters: dict):
    split_dir = RAW_DIR / split
    coco_file = split_dir / "_annotations.coco.json"

    if not coco_file.exists():
        print(f"  Skipping {split} — not found.")
        return

    print(f"\nProcessing: {split}")
    coco      = load_coco(coco_file)
    cat_map   = get_category_map(coco)
    image_map = get_image_map(coco, split_dir)

    for ann in coco["annotations"]:
        # Stop early if both classes are full
        if counters["occupied"] >= MAX_PER_CLASS and counters["empty"] >= MAX_PER_CLASS:
            print(f"  Cap reached — stopping {split} early.")
            break

        category_id = ann["category_id"]
        if category_id not in cat_map:
            continue

        label = cat_map[category_id]

        # Skip if this class is already full
        if counters[label] >= MAX_PER_CLASS:
            continue

        img_path = image_map.get(ann["image_id"])
        if img_path is None or not img_path.exists():
            continue

        x, y, w, h = [int(v) for v in ann["bbox"]]
        if w <= 0 or h <= 0:
            continue

        try:
            img  = Image.open(img_path).convert("RGB")
            crop = img.crop((x, y, x + w, y + h))
        except Exception:
            continue

        filename = f"{split}_{ann['image_id']}_{ann['id']}.jpg"

        if label == "occupied":
            crop.save(OCCUPIED_DIR / filename)
        else:
            crop.save(EMPTY_DIR / filename)

        counters[label] += 1

    print(f"  occupied so far : {counters['occupied']}")
    print(f"  empty so far    : {counters['empty']}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    OCCUPIED_DIR.mkdir(parents=True, exist_ok=True)
    EMPTY_DIR.mkdir(parents=True, exist_ok=True)

    counters = {"occupied": 0, "empty": 0}

    for split in SPLITS:
        if counters["occupied"] >= MAX_PER_CLASS and counters["empty"] >= MAX_PER_CLASS:
            break
        process_split(split, counters)

    print(f"\nDone.")
    print(f"Total occupied : {counters['occupied']}")
    print(f"Total empty    : {counters['empty']}")

if __name__ == "__main__":
    main()