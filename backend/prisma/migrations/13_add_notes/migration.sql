-- CreateEnum
CREATE TYPE "NoteMessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "NoteChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NoteChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" "NoteMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NoteMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteChat_userId_deletedAt_createdAt_idx" ON "NoteChat"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "NoteMessage_chatId_deletedAt_createdAt_idx" ON "NoteMessage"("chatId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "NoteChat" ADD CONSTRAINT "NoteChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteChat" ADD CONSTRAINT "NoteChat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteChat" ADD CONSTRAINT "NoteChat_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMessage" ADD CONSTRAINT "NoteMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "NoteChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
