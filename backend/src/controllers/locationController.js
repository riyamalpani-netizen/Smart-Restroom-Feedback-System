const express = require("express");
const prisma = require("../config/database");

function getOrgFilter(req) {
  const role = req.user?.role;
  const orgId = req.user?.organizationId;
  if (role === "super_admin") return {};
  return { organizationId: orgId };
}

const searchCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60;

async function searchLocations(req, res) {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ results: [] });
    }

    const key = q.trim().toLowerCase();
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.status(200).json(cached.value);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SmartRestroomFeedbackSystem/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ message: "Geocoding service unavailable" });
    }

    const data = await response.json();
    const payload = { results: data };
    searchCache.set(key, { ts: Date.now(), value: payload });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Location search error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function getLocations(req, res) {
  try {
    const { organizationId } = req.query;
    const orgFilter = getOrgFilter(req);
    const where = orgFilter.organizationId ? { organizationId: orgFilter.organizationId } : {};
    if (organizationId && req.user?.role === "super_admin") where.organizationId = organizationId;

    const locations = await prisma.location.findMany({
      where,
      include: {
        floors: true,
        _count: { select: { floors: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Locations fetched successfully",
      locations,
    });
  } catch (error) {
    console.error("Get locations error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function getLocationById(req, res) {
  try {
    const { id } = req.params;
    const orgFilter = getOrgFilter(req);

    const location = await prisma.location.findFirst({
      where: { id, ...orgFilter },
      include: {
        floors: { include: { restrooms: true } },
      },
    });

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location fetched successfully", location });
  } catch (error) {
    console.error("Get location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function createLocation(req, res) {
  try {
    const { organizationId, city, officeName, address, latitude, longitude } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    if (!organizationId || !city || !officeName) {
      return res.status(400).json({ message: "Organization ID, city, and office name are required" });
    }
    if (![latitude, longitude].every((value) => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value)))) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    if (userRole === "vendor_admin" && organizationId !== userOrgId) {
      return res.status(403).json({ message: "You can only create locations in your own organization" });
    }

    const location = await prisma.location.create({
      data: { organizationId, city, officeName, address, latitude: Number(latitude), longitude: Number(longitude) },
    });

    res.status(201).json({ message: "Location created successfully", location });
  } catch (error) {
    console.error("Create location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { city, officeName, address, latitude, longitude } = req.body;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.location.findFirst({
      where: { id, ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Location not found" });
    }
    if ((latitude !== undefined || longitude !== undefined) && ![latitude, longitude].every((value) => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value)))) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const location = await prisma.location.update({
      where: { id },
      data: { city, officeName, address, latitude: latitude === undefined ? existing.latitude : Number(latitude), longitude: longitude === undefined ? existing.longitude : Number(longitude) },
    });

    res.status(200).json({ message: "Location updated successfully", location });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function deleteLocation(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userOrgId = req.user?.organizationId;

    const existing = await prisma.location.findFirst({
      where: { id, ...(userRole !== "super_admin" ? { organizationId: userOrgId } : {}) },
    });

    if (!existing) {
      return res.status(404).json({ message: "Location not found" });
    }

    const floors = await prisma.floor.findMany({ where: { locationId: id }, select: { id: true } });
    const floorIds = floors.map((item) => item.id);
    const [restrooms, zones] = await Promise.all([
      prisma.restroom.findMany({ where: { floorId: { in: floorIds } }, select: { id: true } }),
      prisma.zone.findMany({ where: { floorId: { in: floorIds } }, select: { id: true } }),
    ]);
    const restroomIds = restrooms.map((item) => item.id);
    const zoneIds = zones.map((item) => item.id);
    await prisma.$transaction([
      prisma.device.updateMany({ where: { OR: [{ floorId: { in: floorIds } }, { restroomId: { in: restroomIds } }, { zoneId: { in: zoneIds } }] }, data: { restroomId: null, zoneId: null, floorId: null, floorPlanPosX: null, floorPlanPosY: null, latitude: null, longitude: null } }),
      prisma.gateway.updateMany({ where: { OR: [{ locationId: id }, { floorId: { in: floorIds } }, { zoneId: { in: zoneIds } }] }, data: { locationId: null, floorId: null, zoneId: null, latitude: null, longitude: null } }),
      prisma.notification.deleteMany({ where: { alert: { restroomId: { in: restroomIds } } } }),
      prisma.alert.deleteMany({ where: { restroomId: { in: restroomIds } } }),
      prisma.feedback.deleteMany({ where: { restroomId: { in: restroomIds } } }),
      prisma.zone.deleteMany({ where: { floorId: { in: floorIds } } }),
      prisma.restroom.deleteMany({ where: { floorId: { in: floorIds } } }),
      prisma.floorPlan.deleteMany({ where: { floorId: { in: floorIds } } }),
      prisma.floor.deleteMany({ where: { locationId: id } }),
      prisma.location.delete({ where: { id } }),
    ]);

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Delete location error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  searchLocations,
};
