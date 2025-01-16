-- CreateTable
CREATE TABLE "SchoolInfo" (
    "id" SERIAL NOT NULL,
    "akreditasi" TEXT NOT NULL,
    "jumlahGuru" INTEGER NOT NULL,
    "tenagaPendidikan" INTEGER NOT NULL,
    "jumlahSiswa" INTEGER NOT NULL,
    "namaSekolah" TEXT NOT NULL,
    "nspn" TEXT NOT NULL,
    "jenjangPendidikan" TEXT NOT NULL,
    "statusSekolah" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "rtRw" TEXT NOT NULL,
    "kodePos" TEXT NOT NULL,
    "kecamatan" TEXT NOT NULL,
    "kabKota" TEXT NOT NULL,
    "provinsi" TEXT NOT NULL,
    "negara" TEXT NOT NULL,
    "posisiGeografis" TEXT NOT NULL,

    CONSTRAINT "SchoolInfo_pkey" PRIMARY KEY ("id")
);
