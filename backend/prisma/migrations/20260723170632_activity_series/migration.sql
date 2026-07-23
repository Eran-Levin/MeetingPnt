-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "series_id" TEXT;

-- CreateIndex
CREATE INDEX "activities_series_id_idx" ON "activities"("series_id");
