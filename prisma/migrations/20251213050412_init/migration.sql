-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Detection" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "x1" DOUBLE PRECISION NOT NULL,
    "y1" DOUBLE PRECISION NOT NULL,
    "x2" DOUBLE PRECISION NOT NULL,
    "y2" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Detection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Detection_scanId_idx" ON "Detection"("scanId");

-- AddForeignKey
ALTER TABLE "Detection" ADD CONSTRAINT "Detection_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
