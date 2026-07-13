-- Prisma-generated diff, hand-fixed in two places before applying:
--   1. Task.updatedAt was generated as NOT NULL with no default, which
--      fails outright against the 227 existing Task rows. Added as
--      nullable, backfilled from createdAt, then constrained NOT NULL.
--   2. Added a partial unique index enforcing at most one
--      countsAsDone = true Status per project -- the Prisma schema DSL
--      can't express a filtered/partial unique index directly.
-- Purely additive otherwise: no columns or tables are dropped, no
-- existing data is touched except the updatedAt backfill above.

-- CreateEnum
CREATE TYPE "RolloverMode" AS ENUM ('AUTOMATIC', 'ASK_FIRST');

-- CreateEnum
CREATE TYPE "SyncProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "hasRoadmap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rolloverMode" "RolloverMode" NOT NULL DEFAULT 'ASK_FIRST';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blockedNote" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "focus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "focusTargetDate" TIMESTAMP(3),
ADD COLUMN     "gateId" TEXT,
ADD COLUMN     "movedFromGateAt" TIMESTAMP(3),
ADD COLUMN     "movedFromGateId" TEXT,
ADD COLUMN     "position" DOUBLE PRECISION,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "statusId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill updatedAt for existing rows from createdAt (accurate: "not
-- modified since creation"), then enforce NOT NULL only after backfill.
UPDATE "Task" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "countsAsDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roadmap" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("taskId","tagId")
);

-- CreateTable
CREATE TABLE "TaskRoadmap" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "gateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRoadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGatePlacement" (
    "taskId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,

    CONSTRAINT "TaskGatePlacement_pkey" PRIMARY KEY ("taskId","gateId")
);

-- CreateTable
CREATE TABLE "SyncProposal" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "proposedStatusId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" "SyncProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SyncProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Roadmap_projectId_key" ON "Roadmap"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_projectId_name_key" ON "Tag"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRoadmap_taskId_roadmapId_key" ON "TaskRoadmap"("taskId", "roadmapId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_source_externalId_key" ON "Task"("source", "externalId");

-- Partial unique index: at most one countsAsDone = true Status per
-- project. Belt-and-suspenders alongside application-level enforcement
-- (Postgres has no clean native "exactly one true" constraint).
CREATE UNIQUE INDEX "Status_one_countsAsDone_per_project" ON "Status"("projectId") WHERE "countsAsDone" = true;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_movedFromGateId_fkey" FOREIGN KEY ("movedFromGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRoadmap" ADD CONSTRAINT "TaskRoadmap_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRoadmap" ADD CONSTRAINT "TaskRoadmap_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRoadmap" ADD CONSTRAINT "TaskRoadmap_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGatePlacement" ADD CONSTRAINT "TaskGatePlacement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGatePlacement" ADD CONSTRAINT "TaskGatePlacement_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncProposal" ADD CONSTRAINT "SyncProposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncProposal" ADD CONSTRAINT "SyncProposal_proposedStatusId_fkey" FOREIGN KEY ("proposedStatusId") REFERENCES "Status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
