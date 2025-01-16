-- CreateTable
CREATE TABLE "HeadmasterMessage" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "headmasterName" TEXT NOT NULL,

    CONSTRAINT "HeadmasterMessage_pkey" PRIMARY KEY ("id")
);
