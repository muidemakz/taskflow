-- CreateEnum
CREATE TYPE "PromptTargetTool" AS ENUM ('FIGMA_AI', 'CLAUDE_CODE', 'FIGMA_MAKE', 'OTHER');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'FINAL', 'USED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "promptRulesCategoryId" TEXT;

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetTool" "PromptTargetTool" NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "directionNote" TEXT,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptVersion_taskId_createdAt_idx" ON "PromptVersion"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_promptRulesCategoryId_fkey" FOREIGN KEY ("promptRulesCategoryId") REFERENCES "DocCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
