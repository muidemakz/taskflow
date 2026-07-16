-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareToken" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Gate_shareToken_key" ON "Gate"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Task_shareToken_key" ON "Task"("shareToken");

