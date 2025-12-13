from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from ultralytics import YOLO
from PIL import Image
import io
import os

app = FastAPI()

# Read API key from environment variable
INFERENCE_API_KEY = os.environ.get("INFERENCE_API_KEY")

# Load model ONCE at startup
model = YOLO("models/best.pt")

CLASS_NAMES = model.names  # class index → name mapping


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),  # reads "x-api-key" header
):
    # If an API key is configured, require it
    if INFERENCE_API_KEY:
        if x_api_key != INFERENCE_API_KEY:
            raise HTTPException(status_code=401, detail="Unauthorized")

    # Read image
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Run inference
    results = model(image, conf=0.25)

    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(float, box.xyxy[0])

            detections.append(
                {
                    "class_id": cls_id,
                    "class_name": CLASS_NAMES[cls_id],
                    "confidence": conf,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                }
            )

    return {"num_detections": len(detections), "detections": detections}