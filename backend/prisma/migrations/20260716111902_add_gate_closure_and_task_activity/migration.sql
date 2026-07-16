-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskActivityEventType" AS ENUM ('status_changed', 'gate_changed', 'gate_assigned', 'gate_removed', 'focus_toggled', 'due_date_set', 'priority_changed', 'blocked', 'tag_added', 'tag_removed', 'comment_added', 'moved_by_sync_proposal', 'closed_gate_reason', 'reopened_gate_reason');

-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedReason" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "GateStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventType" "TaskActivityEventType" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "reason" TEXT,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_changedAt_idx" ON "TaskActivity"("taskId", "changedAt");

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
