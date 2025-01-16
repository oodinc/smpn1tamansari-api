-- CreateTable
CREATE TABLE "StrukturOrganisasi" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "StrukturOrganisasi_pkey" PRIMARY KEY ("id")
);
