/*
  Warnings:

  - Added the required column `description` to the `News` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "News" ADD COLUMN     "description" TEXT NOT NULL;
