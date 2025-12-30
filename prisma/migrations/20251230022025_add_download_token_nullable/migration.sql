/*
  Warnings:

  - A unique constraint covering the columns `[download_token]` on the table `File` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "download_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "File_download_token_key" ON "File"("download_token");
