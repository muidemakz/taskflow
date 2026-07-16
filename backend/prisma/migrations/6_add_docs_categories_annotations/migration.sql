-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "DocCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "body" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDocLink" (
    "taskId" TEXT NOT NULL,
    "docEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDocLink_pkey" PRIMARY KEY ("taskId","docEntryId")
);

-- CreateTable
CREATE TABLE "DocAnnotation" (
    "id" TEXT NOT NULL,
    "docEntryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocCategory_projectId_name_key" ON "DocCategory"("projectId", "name");

-- CreateIndex
CREATE INDEX "DocAnnotation_docEntryId_idx" ON "DocAnnotation"("docEntryId");

-- AddForeignKey
ALTER TABLE "DocCategory" ADD CONSTRAINT "DocCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocEntry" ADD CONSTRAINT "DocEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocEntry" ADD CONSTRAINT "DocEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDocLink" ADD CONSTRAINT "TaskDocLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDocLink" ADD CONSTRAINT "TaskDocLink_docEntryId_fkey" FOREIGN KEY ("docEntryId") REFERENCES "DocEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocAnnotation" ADD CONSTRAINT "DocAnnotation_docEntryId_fkey" FOREIGN KEY ("docEntryId") REFERENCES "DocEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocAnnotation" ADD CONSTRAINT "DocAnnotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
