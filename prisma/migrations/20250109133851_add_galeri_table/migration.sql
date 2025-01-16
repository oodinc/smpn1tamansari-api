-- CreateTable
CREATE TABLE "Galeri" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "Galeri_pkey" PRIMARY KEY ("id")
);
