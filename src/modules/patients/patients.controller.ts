import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getOwnPatient } from "../../lib/patient";
import { buildQr } from "../../lib/qr";
import { AppError } from "../../utils/errors";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const updateSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.coerce.date(),
    bloodGroup: z.enum(bloodGroups),
    allergies: z.array(z.string().min(1)),
    chronicConditions: z.array(z.string().min(1)),
  })
  .partial();

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits") });

const contactBase = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phoneNumber: z.string().min(6),
  isPrimary: z.boolean().optional(),
});
const contactUpdateSchema = contactBase.partial();

export const getMe = async (req: Request, res: Response) => {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId: req.user!.id },
    include: { emergencyContacts: true },
  });
  if (!patient) throw new AppError(404, "Patient profile not found");
  const { emergencyPin, ...safe } = patient;
  res.json({ success: true, data: { ...safe, hasEmergencyPin: !!emergencyPin } });
};

export const updateMe = async (req: Request, res: Response) => {
  const data = updateSchema.parse(req.body);
  const patient = await getOwnPatient(req.user!.id);
  const updated = await prisma.patientProfile.update({ where: { id: patient.id }, data });
  const { emergencyPin, ...safe } = updated;
  res.json({ success: true, data: safe });
};

export const setPin = async (req: Request, res: Response) => {
  const { pin } = pinSchema.parse(req.body);
  const patient = await getOwnPatient(req.user!.id);
  await prisma.patientProfile.update({
    where: { id: patient.id },
    data: { emergencyPin: await bcrypt.hash(pin, 10) },
  });
  res.json({ success: true, message: "Emergency PIN updated" });
};

export const addContact = async (req: Request, res: Response) => {
  const data = contactBase.parse(req.body);
  const patient = await getOwnPatient(req.user!.id);
  const contact = await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.emergencyContact.updateMany({ where: { patientId: patient.id }, data: { isPrimary: false } });
    }
    return tx.emergencyContact.create({
      data: { ...data, isPrimary: data.isPrimary ?? false, patientId: patient.id },
    });
  });
  res.status(201).json({ success: true, data: contact });
};

export const updateContact = async (req: Request, res: Response) => {
  const data = contactUpdateSchema.parse(req.body);
  const id = String(req.params.id);
  const patient = await getOwnPatient(req.user!.id);

  const existing = await prisma.emergencyContact.findFirst({ where: { id, patientId: patient.id } });
  if (!existing) throw new AppError(404, "Contact not found");

  const contact = await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.emergencyContact.updateMany({ where: { patientId: patient.id }, data: { isPrimary: false } });
    }
    return tx.emergencyContact.update({ where: { id }, data });
  });
  res.json({ success: true, data: contact });
};

export const deleteContact = async (req: Request, res: Response) => {
  const patient = await getOwnPatient(req.user!.id);
  const { count } = await prisma.emergencyContact.deleteMany({
    where: { id: String(req.params.id), patientId: patient.id },
  });
  if (count === 0) throw new AppError(404, "Contact not found");
  res.json({ success: true, message: "Contact deleted" });
};

export const getQr = async (req: Request, res: Response) => {
  const patient = await getOwnPatient(req.user!.id);
  res.json({ success: true, data: await buildQr(patient) });
};

// Purono QR/link bondho kore notun QR toiri
export const revokeQr = async (req: Request, res: Response) => {
  const patient = await getOwnPatient(req.user!.id);
  const updated = await prisma.patientProfile.update({
    where: { id: patient.id },
    data: { qrTokenVersion: { increment: 1 } },
  });
  res.json({ success: true, message: "Old QR revoked", data: await buildQr(updated) });
};