-- Hand-written (not Prisma-generated): the naive diff would DROP and
-- RECREATE the Task.status column, resetting every row to the default
-- and losing all existing status data. A pure enum type rename is a
-- metadata-only operation in Postgres -- zero data loss, the column
-- keeps its values, only the type name changes.
ALTER TYPE "Status" RENAME TO "TaskStatusLegacy";
