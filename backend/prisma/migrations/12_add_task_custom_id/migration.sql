-- AlterTable
ALTER TABLE "Task" ADD COLUMN "customId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Task_projectId_customId_key" ON "Task"("projectId", "customId");
