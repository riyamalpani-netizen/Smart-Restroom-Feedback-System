-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('happy', 'neutral', 'unhappy');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('online', 'offline');

-- CreateEnum
CREATE TYPE "DeviceHealth" AS ENUM ('healthy', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'vendor_admin', 'facility_manager', 'viewer');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'good',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "restroomId" TEXT NOT NULL,
    "battery" INTEGER NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'online',
    "lastCommunication" TIMESTAMP(3),
    "health" "DeviceHealth" NOT NULL DEFAULT 'healthy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackEntry" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restroomId" TEXT NOT NULL,
    "deviceId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "badgeId" TEXT,
    "battery" INTEGER,
    "deviceStatus" "DeviceStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restroomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "acknowledgedById" TEXT,
    "resolvedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Restroom_badgeId_key" ON "Restroom"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_badgeId_key" ON "Device"("badgeId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_restroomId_fkey" FOREIGN KEY ("restroomId") REFERENCES "Restroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEntry" ADD CONSTRAINT "FeedbackEntry_restroomId_fkey" FOREIGN KEY ("restroomId") REFERENCES "Restroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEntry" ADD CONSTRAINT "FeedbackEntry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_restroomId_fkey" FOREIGN KEY ("restroomId") REFERENCES "Restroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
