-- CreateTable
CREATE TABLE "VisiMisi" (
    "id" SERIAL NOT NULL,
    "visi" TEXT NOT NULL,
    "misi" TEXT[],

    CONSTRAINT "VisiMisi_pkey" PRIMARY KEY ("id")
);
