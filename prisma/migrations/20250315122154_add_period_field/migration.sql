/*
  Warnings:

  - Added the required column `period` to the `Sejarah` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Sejarah" ADD COLUMN     "period" TEXT NOT NULL;
