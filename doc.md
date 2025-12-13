Scoliosis-AI: Fullstack Implementation Guide

A comprehensive beginner-friendly manual (Next.js + Clerk + Prisma + Postgres + S3 + FastAPI YOLO + Vercel + EC2)

Purpose: A web app where a signed-in user uploads a spine X-ray image, the image is stored in AWS S3, metadata and detections are stored in Postgres, and an inference service (FastAPI + Ultralytics YOLO) runs detection and returns bounding boxes that are displayed on the scan page.

Medical disclaimer: This project demonstrates ML inference and data flow. Outputs are not medical advice and must not be treated as a diagnosis.

⸻

Table of Contents
	1.	Architecture Overview
	2.	Repository Structure
	3.	Data Model (Prisma)
	4.	Authentication (Clerk)
	5.	Upload Pipeline (Presigned S3 PUT)
	6.	Viewing Images (Presigned S3 GET)
	7.	Inference Service (FastAPI + YOLO)
	8.	Inference Orchestration (Next.js API route)
	9.	UI Pages (Dashboard, New Scan, Scan Detail)
	10.	Environment Variables
	11.	Database Hosting (Neon) + Migrations
	12.	Deployment (Vercel for Next.js)
	13.	Deployment (EC2 for Inference via Docker)
	14.	AWS S3 CORS (Fixing Browser Upload Issues)
	15.	Common Failure Modes and Debug Playbook
	16.	Hardening and Production Improvements
	17.	Rebuild From Scratch Checklist

⸻

1. Architecture Overview

1.1 Components and Responsibilities

Browser (Client)
	•	Lets users sign in, upload images, and trigger inference.
	•	Uploads images directly to S3 via a presigned URL (does not send image bytes to Vercel).

Next.js App (Vercel)
	•	Hosts the UI and server routes.
	•	Generates S3 presigned URLs.
	•	Writes and reads metadata from Postgres using Prisma.
	•	Orchestrates inference by fetching image bytes from S3 and forwarding them to the inference service.
	•	Saves detections to Postgres.

Postgres (Neon)
	•	Stores scans and detection results (per user).
	•	Provides persistence across sessions and deployments.

AWS S3
	•	Stores uploaded images.
	•	Requires CORS configuration to allow browser PUT uploads from the app domain.

Inference Service (EC2)
	•	FastAPI server that loads a YOLO model once at startup.
	•	Exposes POST /predict for multipart image inference.
	•	Protected with an API key header.

⸻

1.2 End-to-End Flow

Upload flow (S3 presigned PUT)
	1.	User selects an image in /dashboard/new.
	2.	Browser calls Next route POST /api/uploads/presign.
	3.	Next returns:
	•	A presigned PUT URL
	•	An S3 object key (uploads/<userId>/<uuid>.jpg)
	4.	Browser uploads bytes directly to S3 via presigned URL.
	5.	Browser calls POST /api/scans/create with { s3Key }.
	6.	Next inserts a Scan row into Postgres (status UPLOADED).
	7.	Browser navigates to /scan/<scanId>.

Inference flow (Vercel server → S3 → EC2 → Postgres)
	1.	User clicks “Run inference” on /scan/<scanId>.
	2.	Browser calls POST /api/scans/run-inference with { scanId }.
	3.	Next:
	•	Verifies ownership
	•	Sets status to RUNNING
	•	Downloads image bytes from S3
	•	Sends bytes to EC2 inference service POST /predict as multipart form-data
	•	Saves detections in Postgres
	•	Updates status to DONE (or FAILED)
	4.	UI refreshes to show detections and bounding boxes.

⸻

2. Repository Structure

A typical project layout:

prisma/
  schema.prisma
  migrations/

src/
  lib/
    db.ts

  app/
    api/
      uploads/
        presign/route.ts
        view/route.ts
      scans/
        create/route.ts
        run-inference/route.ts

    dashboard/
      page.tsx
      new/
        page.tsx
        upload-form.tsx

    scan/
      [id]/
        page.tsx
        run-inference-button.tsx
        s3-image.tsx
        bbox-overlay.tsx

services/
  inference/
    app.py
    requirements.txt
    Dockerfile
    models/
      best.pt

Key idea:
	•	src/app/... holds Next.js pages and route handlers.
	•	services/inference is an independent service deployed on EC2.
	•	prisma/ holds the schema and migrations.

⸻

3. Data Model (Prisma)

3.1 Schema Goals

The database must:
	•	Track scans by user (ownership enforcement).
	•	Track image location (S3 key).
	•	Track inference status.
	•	Store detections (bounding boxes and classes).

3.2 ScanStatus enum

A scan moves through states:
	•	UPLOADED → image exists and is ready to run
	•	RUNNING → inference in progress
	•	DONE → detections saved
	•	FAILED → inference failed; can retry

3.3 Example Prisma Schema

enum ScanStatus {
  UPLOADED
  RUNNING
  DONE
  FAILED
}

model Scan {
  id               String      @id @default(cuid())
  userId           String
  originalImageUrl String?     // stores S3 key (not a public URL)
  createdAt        DateTime    @default(now())
  status           ScanStatus  @default(UPLOADED)
  detections       Detection[]
}

model Detection {
  id         String   @id @default(cuid())
  scanId     String
  className  String
  confidence Float
  x1         Float
  y1         Float
  x2         Float
  y2         Float

  scan Scan @relation(fields: [scanId], references: [id], onDelete: Cascade)

  @@index([scanId])
}


⸻

4. Authentication (Clerk)

4.1 Why authentication matters here
	•	Uploads and scans must belong to a single user.
	•	All DB reads/writes must enforce ownership (avoid leaking scans across users).

4.2 Server-side auth usage

In server routes and server components:
	•	auth() returns { userId }
	•	If userId is missing, return 401 or null.

4.3 Ownership enforcement pattern

Every query that reads or writes scan data must include:
	•	where: { id: scanId, userId }

This prevents users from accessing another user’s scans even if they guess IDs.

⸻

5. Upload Pipeline (Presigned S3 PUT)

5.1 Why presigned upload

Uploading through Vercel is not ideal for large files. Presigned upload:
	•	Reduces server load and cost.
	•	Avoids timeouts.
	•	Uses S3 directly for file bytes.

5.2 Presign route responsibilities

POST /api/uploads/presign must:
	•	Verify auth.
	•	Choose an S3 key path (namespacing by user is recommended).
	•	Create a presigned URL for PutObject.
	•	Return { url, key }.

5.3 Creating the scan row

After upload finishes, the client calls:
	•	POST /api/scans/create with { s3Key }

This route must:
	•	Verify auth.
	•	Create the Scan row: { userId, originalImageUrl: s3Key, status: "UPLOADED" }.
	•	Return { scanId }.

⸻

6. Viewing Images (Presigned S3 GET)

6.1 Why signed GET is needed

If the S3 bucket is private (recommended), images cannot be fetched directly by <img src="...">.

A signed GET URL is:
	•	Temporary (expires quickly)
	•	Safe (does not require making the bucket public)
	•	Generated server-side and returned to the client

6.2 View route responsibilities

A route like GET /api/uploads/view?key=... should:
	•	Verify auth (and ideally verify scan ownership).
	•	Create a presigned URL for GetObject.
	•	Return the signed URL.

6.3 Rendering images in the scan page

The scan page UI component:
	•	Requests signed URL
	•	Uses it as <img src={signedUrl} />
	•	Optionally overlays detection boxes

⸻

7. Inference Service (FastAPI + YOLO)

7.1 Why inference is separate

Next.js on Vercel is not designed to run heavy ML inference:
	•	Large dependencies (torch/ultralytics)
	•	Startup and memory constraints
	•	CPU usage and timeouts

Running inference on EC2 via Docker provides control and stability.

7.2 services/inference/app.py

Key behavior:
	•	Loads model once at startup (YOLO("models/best.pt"))
	•	Accepts multipart image uploads at /predict
	•	Optionally enforces x-api-key if env var exists
	•	Returns JSON detections including pixel coordinates

Example:

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from ultralytics import YOLO
from PIL import Image
import io
import os

app = FastAPI()

INFERENCE_API_KEY = os.environ.get("INFERENCE_API_KEY")

model = YOLO("models/best.pt")
CLASS_NAMES = model.names

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    if INFERENCE_API_KEY and x_api_key != INFERENCE_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    results = model(image, conf=0.25)

    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(float, box.xyxy[0])
            detections.append({
                "class_id": cls_id,
                "class_name": CLASS_NAMES[cls_id],
                "confidence": conf,
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            })

    return {"num_detections": len(detections), "detections": detections}


⸻

8. Inference Orchestration (Next.js API route)

8.1 Responsibilities

The route POST /api/scans/run-inference must:
	1.	Verify auth and ownership.
	2.	Prevent double runs if already RUNNING.
	3.	Set scan status to RUNNING.
	4.	Download image bytes from S3.
	5.	Send bytes to inference service as multipart form-data.
	6.	Replace detections in DB.
	7.	Set status to DONE or FAILED.

8.2 Notes on multipart form-data in Node

When using a Node buffer, type systems can fail in strict builds. A robust approach is to convert to Uint8Array before building a Blob.

⸻

9. UI Pages

9.1 Dashboard page

Responsibilities:
	•	Require auth.
	•	List scans for current user only (where: { userId }).
	•	Link to /scan/<id>.

9.2 New scan page

Responsibilities:
	•	Provide upload UI
	•	Execute presign → PUT to S3 → create scan → navigate to scan page

9.3 Scan detail page

Responsibilities:
	•	Require auth.
	•	Load scan + detections.
	•	Show image (signed GET).
	•	Show status and inference button.
	•	Render boxes and detection list.
	•	Provide user-friendly status states.

⸻

10. Environment Variables

10.1 Next.js (Vercel + local)

Database
	•	DATABASE_URL

Clerk
	•	NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
	•	CLERK_SECRET_KEY

AWS
	•	AWS_REGION
	•	AWS_S3_BUCKET
	•	AWS_ACCESS_KEY_ID
	•	AWS_SECRET_ACCESS_KEY

Inference
	•	INFERENCE_URL (e.g., http://<EC2_PUBLIC_IP>:8001)
	•	INFERENCE_API_KEY

10.2 Inference service (EC2 container)
	•	INFERENCE_API_KEY must match Next’s INFERENCE_API_KEY (if enabled)

⸻

11. Database Hosting (Neon) + Migrations

11.1 Why local DB cannot work in production

Vercel cannot reach localhost:5432 on a laptop. Production must use a hosted DB.

11.2 Applying migrations to Neon

Set DATABASE_URL to Neon connection string and run:

npx prisma migrate deploy

Expected:
	•	Migrations are applied once
	•	Subsequent runs show “No pending migrations”

⸻

12. Deployment (Vercel for Next.js)

12.1 Common build pitfalls
	•	Strict TypeScript errors that were ignored locally
	•	Missing type packages (e.g., @types/pg)
	•	Incorrect DATABASE_URL pointing to localhost
	•	Blob/Buffer typing mismatch in route handlers

12.2 Deployment steps
	1.	Push to GitHub
	2.	Import repo in Vercel
	3.	Set env vars in Vercel project settings
	4.	Redeploy
	5.	Verify:
	•	Sign in works
	•	Upload works
	•	Dashboard shows scans
	•	Scan page loads image
	•	Run inference works

⸻

13. Deployment (EC2 for Inference via Docker)

13.1 Why Docker
	•	Reproducible builds
	•	Easy dependency installation (torch/ultralytics/cv2)
	•	Portable and restartable service

13.2 Typical workflow on EC2
	1.	SSH to EC2
	2.	Install Docker
	3.	Build image from services/inference
	4.	Run container mapping port 8001

13.3 Networking requirement
	•	The inference service must bind to 0.0.0.0:8001, not 127.0.0.1
	•	EC2 security group must allow inbound 8001
	•	A simple prototype may use 0.0.0.0/0 + API key for protection

⸻

14. AWS S3 CORS (Fixing Upload Issues)

14.1 Why CORS is required

Browser uploads to S3 require:
	•	Preflight OPTIONS request
	•	S3 must respond with appropriate CORS headers

14.2 Example CORS config

Set in S3 bucket CORS settings:

[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://<vercel-domain>"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]


⸻

15. Common Failure Modes and Debug Playbook

15.1 “Can’t reach DB at 127.0.0.1”

Cause: Vercel env var points to local DB.
Fix: set DATABASE_URL to Neon URL and redeploy.

15.2 “CORS blocked” during upload

Cause: S3 CORS missing allowed origin/method.
Fix: update bucket CORS to allow PUT from the site domain.

15.3 “Inference failed: fetch failed (500)”

Common causes:
	•	EC2 port 8001 not open
	•	service not running
	•	INFERENCE_URL wrong
	•	API key mismatch
Fix:
	•	check docker logs
	•	check EC2 security group inbound rule
	•	confirm http://EC2:8001/docs reachable

15.4 Duplicate detections

Cause: inserting new detections without removing old ones.
Fix: delete existing detections for scan before insert.

⸻

16. Hardening and Production Improvements

16.1 Better security for inference
	•	Restrict inbound to known IP ranges (hard with Vercel)
	•	Add rate limiting
	•	Add request size limits
	•	Keep API key enabled

16.2 Background jobs for inference

Current approach runs inference inside a request. Better scaling:
	•	enqueue job and process asynchronously
	•	poll or push status updates to UI

16.3 Store model version

Add fields:
	•	model version hash
	•	inference time
	•	image width/height
This helps when updating models later.

⸻

17. Rebuild From Scratch Checklist
	1.	Clone repo
	2.	Install deps: npm ci
	3.	Add .env.local with required env vars
	4.	Run migrations against Neon: npx prisma migrate deploy
	5.	Start Next locally: npm run dev
	6.	Start inference locally or on EC2
	7.	Test: upload → scan page shows image
	8.	Test: run inference → detections saved and rendered
	9.	Configure S3 CORS
	10.	Deploy Next to Vercel with env vars
	11.	Deploy inference to EC2 with port + API key
	12.	End-to-end test in production

⸻

Appendix: Project Intent and Motivation (Why this design)

Why separate storage and compute
	•	S3 handles large binary objects efficiently.
	•	Postgres handles structured metadata and relationships.
	•	EC2 inference handles compute-heavy ML workloads.
	•	Vercel handles web hosting + server routes with low ops overhead.

This division allows:
	•	Scale uploads without scaling servers
	•	Keep images private
	•	Keep inference predictable and restartable
	•	Keep the web app deployable via Git push

⸻
