-- Coordinates are persisted for map placements and are intentionally nullable:
-- inventory devices have no physical placement until they are assigned.
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

ALTER TABLE "floor_plans" ADD COLUMN IF NOT EXISTS "scale" DOUBLE PRECISION NOT NULL DEFAULT 1;
