# 🩻 Scoliosis-AI — Fullstack Implementation Manual  
**Next.js (App Router) + Tailwind + shadcn/ui + Clerk + Prisma + Postgres (Neon) + S3 + FastAPI (YOLO) + Vercel + EC2**

> **Purpose:** A web app where a signed-in user uploads a spine X-ray image, the image is stored in **AWS S3**, metadata + detections are stored in **Postgres**, and an **inference service** (FastAPI + Ultralytics YOLO) runs detection and returns bounding boxes that are displayed on the scan page.  
> **Disclaimer:** This is a demo/education project. Outputs are **not medical advice**.

---

## 📚 Table of Contents
1. **Architecture Overview**
2. **Repository Structure**
3. **Data Model (Prisma)**
4. **Auth (Clerk)**
5. **Upload Pipeline (S3 presigned PUT)**
6. **Viewing Images (S3 presigned GET)**
7. **Inference Service (FastAPI + YOLO)**
8. **Inference Orchestration (Next API route)**
9. **UI Pages (Dashboard / New / Scan)**
10. **Environment Variables**
11. **Database (Neon) + Migrations**
12. **Deploy Next.js to Vercel**
13. **Deploy Inference to EC2 (Docker)**
14. **S3 CORS (Fixing “blocked by CORS”)**
15. **Debug Playbook**
16. **Production Hardening**
17. **Rebuild From Scratch Checklist**

---

# 1) 🧠 Architecture Overview

## 1.1 Components & Responsibilities

### **Browser (Client)**
- Signs in with Clerk.
- Uploads the file **directly to S3** (using a presigned URL).
- Triggers inference by calling a Next.js API route.

### **Next.js App (Vercel)**
- Hosts UI pages.
- Creates presigned S3 URLs (PUT for upload, GET for viewing).
- Writes and reads scan metadata + detections via Prisma.
- Calls inference service from server-side route and saves results.

### **Postgres (Neon)**
- Stores `Scan` and `Detection` tables.
- Guarantees persistence across reloads and deployments.

### **AWS S3**
- Stores uploaded images.
- Must have correct **CORS** for browser uploads.
- Recommended: keep bucket private; serve images via **signed GET** URLs.

### **Inference Service (EC2, Docker)**
- FastAPI app with Ultralytics YOLO.
- Loads the model once at startup.
- Exposes `POST /predict` that accepts an image file and returns detections.

---

## 1.2 End-to-End Flow (Big Picture)

### ✅ Upload flow: **Presigned PUT**
1. User selects image in `/dashboard/new`.
2. Client calls **`POST /api/uploads/presign`**.
3. Server returns:
   - a **presigned PUT URL**
   - an **S3 key** like `uploads/<userId>/<uuid>.jpg`
4. Client uploads bytes directly to S3 with `fetch(putUrl, { method: "PUT", body: file })`.
5. Client calls **`POST /api/scans/create`** with `{ s3Key }`.
6. Server inserts `Scan` row into Postgres (`status = UPLOADED`).
7. Client navigates to `/scan/<scanId>`.

### ✅ Inference flow: **Vercel server → S3 → EC2 → Postgres**
1. User clicks **Run inference** on `/scan/<scanId>`.
2. Client calls **`POST /api/scans/run-inference`**.
3. Server:
   - verifies ownership
   - sets scan status `RUNNING`
   - downloads image bytes from S3
   - POSTs bytes to EC2 `/predict` as multipart form-data
   - saves detections in Postgres
   - sets status to `DONE` (or `FAILED`)
4. UI refreshes; boxes + detection list appear.

---

# 2) 🗂 Repository Structure

Typical layout:

```
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
```

**Key idea:**  
- `src/app/api/**` are server endpoints.
- `src/app/**/page.tsx` are UI pages.
- `services/inference` is deployed separately to EC2.

---

# 3) 🧱 Data Model (Prisma)

## 3.1 Why store scans + detections
- Need persistent record per upload.
- Need to associate detections with a scan.
- Must enforce user ownership.

## 3.2 Schema (example)

**File:** `prisma/schema.prisma`

```prisma
enum ScanStatus {
  UPLOADED
  RUNNING
  DONE
  FAILED
}

model Scan {
  id               String      @id @default(cuid())
  userId           String
  originalImageUrl String?     // stores S3 key
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
```

---

# 4) 🔐 Authentication (Clerk)

## 4.1 Why auth is required
- Prevent users from seeing each other’s scans.
- Every scan belongs to one `userId`.

## 4.2 Ownership enforcement pattern
In every server route that loads a scan:
```ts
const scan = await prisma.scan.findFirst({
  where: { id: scanId, userId },
});
```

If `scan` is null → **404**.

---

# 5) ☁️ Upload Pipeline (S3 Presigned PUT)

## 5.1 Why presigned PUT upload
Uploading through Vercel is slower and can time out. Presigned PUT:
- uploads directly from browser to S3
- reduces server load & cost
- scales better

## 5.2 Presign route

**File:** `src/app/api/uploads/presign/route.ts`

**Responsibilities**
- authenticate user
- create key `uploads/<userId>/<uuid>.<ext>`
- return presigned PUT url + key

**Outputs**
```json
{ "url": "<presigned_put_url>", "key": "uploads/user_xxx/uuid.jpg" }
```

## 5.3 Create scan route

**File:** `src/app/api/scans/create/route.ts`

**Responsibilities**
- authenticate user
- accept `{ s3Key }`
- create scan in DB

---

# 6) 🖼 Viewing Images (Presigned S3 GET)

## 6.1 Why signed GET
If bucket is private (recommended), direct S3 URLs won’t work without signing. Signed GET:
- temporary
- secure
- works in `<img src="...">`

## 6.2 View route (signed GET)

**File:** `src/app/api/uploads/view/route.ts`

**Responsibilities**
- authenticate
- validate requested key belongs to current user (best practice)
- return signed GET URL

---

# 7) 🤖 Inference Service (FastAPI + YOLO)

## 7.1 Why inference is separate from Vercel
Ultralytics/torch are heavy; Vercel is optimized for web functions. EC2 + Docker:
- stable runtime
- predictable memory/CPU
- easier debugging logs

## 7.2 FastAPI app

**File:** `services/inference/app.py`

```py
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
```

---

# 8) 🧭 Inference Orchestration (Next.js API Route)

## 8.1 Responsibilities
**File:** `src/app/api/scans/run-inference/route.ts`

Must:
- auth + ownership check
- block double runs
- set status to RUNNING
- fetch from S3 (GetObject)
- send multipart to EC2 `/predict` with `x-api-key`
- replace detections
- update status DONE/FAILED

**Important:** Delete old detections to prevent duplicates:
```ts
await prisma.detection.deleteMany({ where: { scanId } });
```

---

# 9) 🧑‍💻 UI Pages

## 9.1 Dashboard page
**File:** `src/app/dashboard/page.tsx`

Loads scans:
```ts
const scans = await prisma.scan.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
});
```

Shows list and link to `/scan/[id]`.

## 9.2 New scan page
**File:** `src/app/dashboard/new/page.tsx` (and `upload-form.tsx`)

Client steps:
1) call `/api/uploads/presign`
2) `PUT` to S3 URL
3) call `/api/scans/create`
4) `router.push(/scan/<id>)`

## 9.3 Scan page
**File:** `src/app/scan/[id]/page.tsx`

Shows:
- scan metadata
- status
- run inference button
- image + overlay
- detection list + summary label

---

# 10) 🔧 Environment Variables

## 10.1 Next.js (local + Vercel)
**Database**
- `DATABASE_URL`

**Clerk**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

**AWS**
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Inference**
- `INFERENCE_URL` (e.g. `http://3.147.81.87:8001`)
- `INFERENCE_API_KEY`

## 10.2 Inference service (EC2 Docker)
- `INFERENCE_API_KEY` (must match Next.js)

---

# 11) 🗄 Neon + Migrations

## 11.1 Why Neon
Vercel cannot reach laptop DB. Hosted DB required.

## 11.2 Apply migrations
```bash
npx prisma migrate deploy
```

---

# 12) 🚀 Deploy Next.js to Vercel

**Steps**
1. Push repo to GitHub
2. Import in Vercel
3. Set env vars in Vercel
4. Redeploy
5. Verify:
   - dashboard loads
   - upload works
   - scan page shows image
   - inference triggers

---

# 13) 🐳 Deploy Inference to EC2 (Docker)

## 13.1 Why Docker on EC2
- consistent builds
- manageable deps

## 13.2 Core networking rules
- Uvicorn must bind to `0.0.0.0:8001`
- EC2 security group must allow inbound `8001`
- For quick demo: allow `0.0.0.0/0` + API key

---

# 14) 🌐 S3 CORS (Fixing Upload Failures)

## 14.1 Why CORS happens
Browser does a preflight request. S3 must respond with `Access-Control-Allow-Origin`.

## 14.2 Example CORS config
**S3 bucket → Permissions → CORS:**
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://scoliosis-ai.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

# 15) 🧰 Debug Playbook (Most Common Issues)

## “Can’t reach database server at 127.0.0.1:5432”
- Vercel is trying to connect to localhost.
- Fix: set `DATABASE_URL` to Neon in Vercel settings.

## “CORS blocked” when uploading to S3
- Bucket CORS missing allowed origin or PUT.
- Fix: update CORS and redeploy/test again.

## “Inference failed (500): fetch failed”
- EC2 inbound 8001 blocked
- wrong `INFERENCE_URL`
- API key mismatch
- service down
**Fix:** check EC2 security group + `docker logs`.

## Duplicate detections
- Not deleting existing detections before inserting.
- Fix: `deleteMany({ scanId })` first.

---

# 16) 🔒 Production Hardening (Recommended Next Steps)

- Restrict EC2 inbound access if possible (hard with Vercel)
- Keep API key enabled
- Add rate limiting
- Add background jobs (queue inference) to avoid long server requests
- Record model version + inference time in DB
- Add monitoring/logging

---

# 17) ✅ Rebuild From Scratch Checklist

1. Clone repo  
2. `npm ci`  
3. Add `.env.local`  
4. `npx prisma migrate deploy` (Neon)  
5. `npm run dev`  
6. Start inference service (local or EC2)  
7. Test: upload → scan shows image  
8. Test: run inference → detections saved  
9. Configure S3 CORS  
10. Deploy Next.js to Vercel  
11. Deploy inference to EC2  
12. End-to-end production test ✅
