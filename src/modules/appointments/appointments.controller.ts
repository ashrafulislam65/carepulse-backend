import { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getOwnPatient } from "../../lib/patient";
import { env } from "../../config/env";
import { dayStart, dayWindow, generateSlots, isValidSlot, localDateString } from "../../lib/slots";
import { AppError } from "../../utils/errors";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const bookSchema = z.object({ doctorId: z.string().min(1), scheduledAt: z.coerce.date() });

type Actor = { id: string; role: Role };
type ApptWithOwners = {
  patient: { userId: string };
  doctor: { userId: string };
};

const canView = (user: Actor, a: ApptWithOwners) =>
  user.role === "ADMIN" ||
  (user.role === "PATIENT" && a.patient.userId === user.id) ||
  (user.role === "DOCTOR" && a.doctor.userId === user.id);

const loadAppointment = async (id: string) => {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
  });
  if (!a) throw new AppError(404, "Appointment not found");
  return a;
};

export const listDoctors = async (_req: Request, res: Response) => {
  const doctors = await prisma.doctorProfile.findMany({
    select: { id: true, fullName: true, specialty: true, consultationFee: true },
    orderBy: { fullName: "asc" },
  });
  res.json({ success: true, data: doctors });
};

export const getSlots = async (req: Request, res: Response) => {
  const date = dateSchema.parse(req.query.date);
  const doctorId = String(req.params.doctorId);

  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new AppError(404, "Doctor not found");

  const { start, end } = dayWindow(date);
  const booked = await prisma.appointment.findMany({
    where: { doctorId, status: { not: "CANCELLED" }, scheduledAt: { gte: start, lt: end } },
    select: { scheduledAt: true },
  });
  const bookedSet = new Set(booked.map((b) => b.scheduledAt.getTime()));
  const now = Date.now();

  const slots = generateSlots(date).map((s) => ({
    time: s.toISOString(),
    available: !bookedSet.has(s.getTime()) && s.getTime() > now,
  }));
  res.json({ success: true, data: slots });
};

export const book = async (req: Request, res: Response) => {
  const { doctorId, scheduledAt } = bookSchema.parse(req.body);
  const patient = await getOwnPatient(req.user!.id);

  if (!isValidSlot(scheduledAt)) throw new AppError(400, "Invalid time slot");
  if (scheduledAt.getTime() <= Date.now()) throw new AppError(400, "Slot is in the past");

  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new AppError(404, "Doctor not found");

  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        const taken = await tx.appointment.findFirst({
          where: { doctorId, scheduledAt, status: { not: "CANCELLED" } },
        });
        if (taken) throw new AppError(409, "Slot already booked");
        return tx.appointment.create({
          data: { patientId: patient.id, doctorId, scheduledAt, amount: doctor.consultationFee },
        });
      },
      // duijon ekshathe same slot book korle ekjon-i pabe
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    res.status(201).json({ success: true, data: appointment });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      throw new AppError(409, "Slot was just booked by someone else, please pick another");
    }
    throw e;
  }
};

export const listMine = async (req: Request, res: Response) => {
  const user = req.user!;
  let where: Prisma.AppointmentWhereInput = {};

  if (user.role === "PATIENT") {
    where = { patientId: (await getOwnPatient(user.id)).id };
  } else if (user.role === "DOCTOR") {
    const doc = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
    if (!doc) throw new AppError(404, "Doctor profile not found");
    where = { doctorId: doc.id };
  }

  const data = await prisma.appointment.findMany({
    where,
    include: {
      doctor: { select: { fullName: true, specialty: true } },
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });
  res.json({ success: true, data });
};

export const cancel = async (req: Request, res: Response) => {
  const a = await loadAppointment(String(req.params.id));
  if (!canView(req.user!, a)) throw new AppError(403, "No access");
  if (a.status !== "SCHEDULED") throw new AppError(409, "Only scheduled appointments can be cancelled");

  const updated = await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
  res.json({ success: true, data: updated });
};

export const complete = async (req: Request, res: Response) => {
  const a = await loadAppointment(String(req.params.id));
  if (a.doctor.userId !== req.user!.id) throw new AppError(403, "No access");
  if (a.status !== "SCHEDULED") throw new AppError(409, "Appointment is not scheduled");

  const updated = await prisma.appointment.update({ where: { id: a.id }, data: { status: "COMPLETED" } });
  res.json({ success: true, data: updated });
};

export const queueStatus = async (req: Request, res: Response) => {
  const a = await loadAppointment(String(req.params.id));
  if (!canView(req.user!, a)) throw new AppError(403, "No access");

  if (a.status !== "SCHEDULED") {
    return res.json({ success: true, data: { appointmentId: a.id, status: a.status, position: null } });
  }

  const start = dayStart(localDateString(a.scheduledAt));
  const ahead = await prisma.appointment.count({
    where: { doctorId: a.doctorId, status: "SCHEDULED", scheduledAt: { gte: start, lt: a.scheduledAt } },
  });

  res.json({
    success: true,
    data: {
      appointmentId: a.id,
      status: a.status,
      scheduledAt: a.scheduledAt,
      patientsAhead: ahead,
      position: ahead + 1,
      estimatedWaitMinutes: ahead * env.SLOT_MINUTES,
    },
  });
};