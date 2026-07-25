-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('planned', 'in_progress', 'completed');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "status" "GroupStatus" NOT NULL DEFAULT 'planned';
