require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { repairExistingDevice } = require("../src/services/ttnDeviceRegistryService");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const KNOWN_TTN_IDS = {
  "4C1A583CED69285C": "badge-cvbn",
  "A47C76AB8A01FFB3": "badge-femalere",
  "5A332A6AEA49B740": "badge-abcd",
  "4AA5C03A4D88D12E": "badge-zdcfg",
  "973FDFA6CFFBA920": "badge-restroom",
  "571D859BDB2A7D5F": "badge-lobbysen",
};

async function main() {
  const devices = await prisma.device.findMany({
    where: {
      joinEui: { not: null },
      appKey: { not: null },
    },
    select: {
      id: true,
      name: true,
      deviceEui: true,
      badgeId: true,
      joinEui: true,
      appKey: true,
      lorawanVersion: true,
      lorawanPhyVersion: true,
    },
  });

  console.log(`Found ${devices.length} devices to repair in TTN...`);

  for (const device of devices) {
    try {
      const devEui = device.deviceEui?.toUpperCase();
      const candidates = [
        KNOWN_TTN_IDS[devEui],
        `device-${device.deviceEui.toLowerCase()}`,
        `badge-${device.badgeId?.toLowerCase()}`,
      ].filter(Boolean);

      let result = null;
      let lastError = null;

      for (const candidateId of candidates) {
        try {
          result = await repairExistingDevice({
            deviceEui: device.deviceEui,
            deviceId: candidateId,
            joinEui: device.joinEui,
            appKey: device.appKey,
            lorawanVersion: device.lorawanVersion || undefined,
            lorawanPhyVersion: device.lorawanPhyVersion || undefined,
          });
          break;
        } catch (error) {
          lastError = error;
          const alreadyRegisteredMatch = error.message.match(/already registered as `([^`]+)`/);
          if (alreadyRegisteredMatch) {
            const actualDeviceId = alreadyRegisteredMatch[1];
            try {
              result = await repairExistingDevice({
                deviceEui: device.deviceEui,
                deviceId: actualDeviceId,
                joinEui: device.joinEui,
                appKey: device.appKey,
                lorawanVersion: device.lorawanVersion || undefined,
                lorawanPhyVersion: device.lorawanPhyVersion || undefined,
              });
              break;
            } catch (retryError) {
              lastError = retryError;
              continue;
            }
          }
          throw error;
        }
      }

      if (result) {
        console.log(`✓ Repaired: ${device.name || device.badgeId} (${device.deviceEui}) -> ${result.deviceId}`);
      } else {
        throw lastError || new Error("No valid TTN device ID found");
      }
    } catch (error) {
      console.error(`✗ Failed: ${device.name || device.badgeId} (${device.deviceEui}): ${error.message}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Repair script failed:", error);
  process.exit(1);
});
