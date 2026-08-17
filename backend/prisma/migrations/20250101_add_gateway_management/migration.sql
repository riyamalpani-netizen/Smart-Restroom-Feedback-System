-- Add gatewayId column to devices
ALTER TABLE "devices" ADD COLUMN "gatewayId" TEXT;
ALTER TABLE "devices" ADD CONSTRAINT "devices_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add gateway columns if missing
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "gatewayEui" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "floorId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "ttnStatus" TEXT DEFAULT 'not_registered';
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "ttnDeviceId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "frequencyPlanId" TEXT;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "gateways" ADD COLUMN IF NOT EXISTS "connectedDevices" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "gateways_gatewayEui_key" ON "gateways"("gatewayEui");
