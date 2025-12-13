import random
import requests
from pathlib import Path

INFERENCE_URL = "http://localhost:8001/predict"

DATASET_ROOT = Path("../../data/scoliosis-yolov5/test/images")
N_SAMPLES = 30   # start small

def main():
    images = list(DATASET_ROOT.glob("*.jpg")) + list(DATASET_ROOT.glob("*.png"))
    samples = random.sample(images, min(N_SAMPLES, len(images)))

    total = 0
    with_detections = 0
    class_counts = {}

    for img_path in samples:
        with open(img_path, "rb") as f:
            res = requests.post(
                INFERENCE_URL,
                files={"file": f},
                timeout=30,
            )

        if not res.ok:
            print("❌ Error on", img_path.name)
            continue

        data = res.json()
        total += 1

        if data["num_detections"] > 0:
            with_detections += 1

        for d in data["detections"]:
            class_counts[d["class_name"]] = class_counts.get(d["class_name"], 0) + 1

        print(f"{img_path.name}: {data['num_detections']} detections")

    print("\n==== SUMMARY ====")
    print(f"Images tested: {total}")
    print(f"Images with ≥1 detection: {with_detections}")
    print(f"Detection rate: {with_detections / max(total,1):.2%}")
    print("Class counts:", class_counts)


if __name__ == "__main__":
    main()