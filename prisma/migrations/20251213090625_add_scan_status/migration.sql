-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('UPLOADED', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Scan" ADD COLUMN     "status" "ScanStatus" NOT NULL DEFAULT 'UPLOADED';
