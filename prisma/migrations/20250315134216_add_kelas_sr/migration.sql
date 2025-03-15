-- CreateTable
CREATE TABLE "KelasSR" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KelasSR_pkey" PRIMARY KEY ("id")
);
