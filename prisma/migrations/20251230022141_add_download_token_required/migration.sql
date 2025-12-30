/*
  Warnings:

  - Made the column `download_token` on table `File` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "File" ALTER COLUMN "download_token" SET NOT NULL;
