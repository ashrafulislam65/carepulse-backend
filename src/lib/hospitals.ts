import { prisma } from "./prisma";
import { distanceKm } from "./geo";

export const nearestHospitals = async (lat: number, lng: number, limit = 3) => {
  const all = await prisma.hospital.findMany();
  return all
    .map((h) => ({ ...h, distanceKm: Number(distanceKm(lat, lng, h.latitude, h.longitude).toFixed(2)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
};