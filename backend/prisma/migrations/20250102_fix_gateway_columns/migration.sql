DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'gatewayId') THEN
    ALTER TABLE "devices" ADD COLUMN "gatewayId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'devices' AND constraint_name = 'devices_gatewayId_fkey') THEN
    ALTER TABLE "devices" ADD CONSTRAINT "devices_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'gatewayEui') THEN
    ALTER TABLE "gateways" ADD COLUMN "gatewayEui" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'organizationId') THEN
    ALTER TABLE "gateways" ADD COLUMN "organizationId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'locationId') THEN
    ALTER TABLE "gateways" ADD COLUMN "locationId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'floorId') THEN
    ALTER TABLE "gateways" ADD COLUMN "floorId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'zoneId') THEN
    ALTER TABLE "gateways" ADD COLUMN "zoneId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'ttnStatus') THEN
    ALTER TABLE "gateways" ADD COLUMN "ttnStatus" TEXT DEFAULT 'not_registered';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'ttnDeviceId') THEN
    ALTER TABLE "gateways" ADD COLUMN "ttnDeviceId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'frequencyPlanId') THEN
    ALTER TABLE "gateways" ADD COLUMN "frequencyPlanId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'latitude') THEN
    ALTER TABLE "gateways" ADD COLUMN "latitude" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'longitude') THEN
    ALTER TABLE "gateways" ADD COLUMN "longitude" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gateways' AND column_name = 'connectedDevices') THEN
    ALTER TABLE "gateways" ADD COLUMN "connectedDevices" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'gateways_gatewayEui_key') THEN
    CREATE UNIQUE INDEX "gateways_gatewayEui_key" ON "gateways"("gatewayEui");
  END IF;
END $$;
