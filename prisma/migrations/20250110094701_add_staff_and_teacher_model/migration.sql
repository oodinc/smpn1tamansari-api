-- CreateTable
CREATE TABLE "StaffAndTeacher" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "StaffAndTeacher_pkey" PRIMARY KEY ("id")
);
