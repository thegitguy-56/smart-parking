import json
import os
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
RAW_DIR   = Path(__file__).resolve().parents[1] / "data" / "raw"
TRAIN_DIR = RAW_DIR / "train"
COCO_FILE = TRAIN_DIR / "_annotations.coco.json"
OUTPUT    = RAW_DIR / "slot_map.json"


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------
def load_coco(path: Path) -> dict:
    with open(path, "r") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------
def build_slot_map(coco: dict) -> list[dict]:
    """
    The parking lot camera is fixed, so every frame shows the same physical
    slots. We pick the image that has the most annotations as our reference
    frame (most complete view), extract each slot's bounding box, sort them
    top-to-bottom then left-to-right, and assign stable slot_ids starting at 1.
    """

    # Group annotation counts per image
    ann_count: dict[int, int] = defaultdict(int)
    ann_by_image: dict[int, list] = defaultdict(list)

    for ann in coco["annotations"]:
        iid = ann["image_id"]
        ann_count[iid] += 1
        ann_by_image[iid].append(ann)

    # Pick reference image — the one with the most annotations
    ref_image_id = max(ann_count, key=ann_count.get)
    ref_image    = next(img for img in coco["images"] if img["id"] == ref_image_id)
    ref_anns     = ann_by_image[ref_image_id]

    print(f"Reference frame : {ref_image['file_name']}")
    print(f"Slots in frame  : {len(ref_anns)}")

    # Sort slots: top-to-bottom (y), then left-to-right (x)
    sorted_anns = sorted(ref_anns, key=lambda a: (round(a["bbox"][1] / 20), a["bbox"][0]))

    slots = []
    for idx, ann in enumerate(sorted_anns):
        x, y, w, h = ann["bbox"]
        slots.append({
            "slot_id" : idx + 1,
            "x"       : round(x, 2),
            "y"       : round(y, 2),
            "w"       : round(w, 2),
            "h"       : round(h, 2),
            "cx"      : round(x + w / 2, 2),
            "cy"      : round(y + h / 2, 2),
        })

    return slots, ref_image["file_name"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Loading COCO annotations ...")
    coco = load_coco(COCO_FILE)

    print(f"Total images      : {len(coco['images'])}")
    print(f"Total annotations : {len(coco['annotations'])}")
    print(f"Categories        : {[c['name'] for c in coco['categories']]}")
    print()

    slots, ref_frame = build_slot_map(coco)

    output = {
        "reference_frame" : ref_frame,
        "total_slots"     : len(slots),
        "slots"           : slots,
    }

    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nslot_map.json written to : {OUTPUT}")
    print(f"Total slots mapped       : {len(slots)}")


if __name__ == "__main__":
    main()