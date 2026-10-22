import { Request, Response } from "express";
import { AlertStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getOwnPatient } from "../../lib/patient";
import { getIO } from "../../lib/socket";
import { nearestHospitals } from "../../lib/hospitals";
import { distanceKm } from "../../lib/geo";
import { sendSms } from "../../lib/notify";
import { AppError } from "../../utils/errors";

const ACTIVE: AlertStatus[] = ["TRIGGERED", "DISPATCHED"];

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const patientSelect = {
  firstName: true,
  lastName: true,
  bloodGroup: true,
  allergies: true,
  chronicConditions: true,
  emergencyContacts: { select: { name: true, relationship: true, phoneNumber: true, isPrimary: true } },
} as const;

const broadcastUpdate = async (alertId: string) => {
  const a = await prisma.emergencyAlert.findUnique({
    where: { id: alertId },
    include: { patient: { select: { userId: true } } },
  });
  if (!a) return;
  getIO()
    ?.to(`alert:${a.id}`)
    .to("responders")
    .to(`user:${a.patient.userId}`)
    .emit("alert:updated", { id: a.id, status: a.status, responderId: a.responderId });
};

// SOS trigger
export const createAlert = async (req: Request, res: Response) => {
  const loc = locationSchema.parse(req.body);
  const patient = await getOwnPatient(req.user!.id);

  const existing = await prisma.emergencyAlert.findFirst({
    where: { patientId: patient.id, status: { in: ACTIVE } },
  });
  if (existing) {
    return res.json({ success: true, message: "You already have an active alert", data: { alert: existing } });
  }

  const alert = await prisma.emergencyAlert.create({ data: { patientId: patient.id, ...loc } });
  const nearbyHospitals = await nearestHospitals(loc.latitude, loc.longitude, 3);
  const contacts = await prisma.emergencyContact.findMany({ where: { patientId: patient.id } });

  const payload = {
    alert,
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      bloodGroup: patient.bloodGroup,
      allergies: patient.allergies,
      chronicConditions: patient.chronicConditions,
    },
    nearbyHospitals,
  };

  getIO()?.to("responders").emit("alert:new", payload);

  const link = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
  await Promise.allSettled(
    contacts.map((c) =>
      sendSms(c.phoneNumber, `SOS: ${patient.firstName} ${patient.lastName} needs emergency help. Location: ${link}`)
    )
  );

  res.status(201).json({ success: true, data: payload });
};

export const listActive = async (req: Request, res: Response) => {
  const q = z
    .object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() })
    .parse(req.query);

  const alerts = await prisma.emergencyAlert.findMany({
    where: { status: { in: ACTIVE } },
    include: { patient: { select: patientSelect } },
    orderBy: { createdAt: "desc" },
  });

  let data: unknown[] = alerts;
  if (q.lat !== undefined && q.lng !== undefined) {
    data = alerts
      .map((a) => ({ ...a, distanceKm: Number(distanceKm(q.lat!, q.lng!, a.latitude, a.longitude).toFixed(2)) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
  res.json({ success: true, data });
};

export const getAlert = async (req: Request, res: Response) => {
  const alert = await prisma.emergencyAlert.findUnique({
    where: { id: String(req.params.id) },
    include: { patient: { select: { userId: true, ...patientSelect } } },
  });
  if (!alert) throw new AppError(404, "Alert not found");

  const user = req.user!;
  const allowed =
    user.role === "ADMIN" || user.role === "RESPONDER" || (user.role === "PATIENT" && alert.patient.userId === user.id);
  if (!allowed) throw new AppError(403, "No access to this alert");

  const { userId, ...patient } = alert.patient;
  res.json({ success: true, data: { ...alert, patient } });
};

// Responder alert accept kore (duijon ekshathe accept korle ekjon-i pabe)
export const acceptAlert = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { count } = await prisma.emergencyAlert.updateMany({
    where: { id, status: "TRIGGERED" },
    data: { status: "DISPATCHED", responderId: req.user!.id },
  });
  if (count === 0) throw new AppError(409, "Alert not found or already taken");

  await broadcastUpdate(id);
  res.json({ success: true, data: await prisma.emergencyAlert.findUnique({ where: { id } }) });
};

export const resolveAlert = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { count } = await prisma.emergencyAlert.updateMany({
    where: { id, status: { in: ACTIVE } },
    data: { status: "RESOLVED" },
  });
  if (count === 0) throw new AppError(404, "Active alert not found");

  await broadcastUpdate(id);
  res.json({ success: true, message: "Alert resolved" });
};

export const cancelAlert = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const patient = await getOwnPatient(req.user!.id);
  const { count } = await prisma.emergencyAlert.updateMany({
    where: { id, patientId: patient.id, status: { in: ACTIVE } },
    data: { status: "CANCELLED" },
  });
  if (count === 0) throw new AppError(404, "Active alert not found");

  await broadcastUpdate(id);
  res.json({ success: true, message: "Alert cancelled" });
};