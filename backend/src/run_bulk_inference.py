# backend/src/run_bulk_inference.py  — run this once to populate occupancy_log

from pathlib import Path
from src.detector import Detector

IMAGE_DIR = Path("data/raw/train")   # or test or valid
det = Detector()

images = sorted(IMAGE_DIR.glob("*.jpg"))
print(f"Processing {len(images)} images ...")

for i, img_path in enumerate(images, 1):
    try:
        det.run(img_path)
    except Exception as e:
        print(f"  Skipped {img_path.name}: {e}")
    if i % 50 == 0:
        print(f"  {i}/{len(images)} done")

print("Bulk inference complete.")