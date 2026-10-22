import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { getOwnPatient } from "../../lib/patient";
import { canAccessPatient } from "../../lib/access";
import { createDownloadUrl, createUploadUrl, deleteObject } from "../../lib/s3";
import { AppError } from "../../utils/errors";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  patientId: z.string().min(1).optional(),
});

const createSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  patientId: z.string().min(1).optional(),
});

// PATIENT hole nijer, DOCTOR/ADMIN hole patientId lagbe
const resolvePatientId = async (req: Request, patientId?: string) => {
  const user = req.user!;
  if (user.role === "PATIENT") return (await getOwnPatient(user.id)).id;
  if (!patientId) throw new AppError(400, "patientId is required");
  if (!(await canAccessPatient(user, patientId))) throw new AppError(403, "No access to this patient");
  return patientId;
};

export const getUploadUrl = async (req: Request, res: Response) => {
  const data = uploadSchema.parse(req.body);
  const patientId = await resolvePatientId(req, data.patientId);

  const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `records/${patientId}/${randomUUID()}-${safeName}`;
  const uploadUrl = await createUploadUrl(key, data.contentType);

  res.json({ success: true, data: { uploadUrl, key, expiresInSeconds: 300 } });
};

export const createRecord = async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const patientId = await resolvePatientId(req, data.patientId);

  if (!data.key.startsWith(`records/${patientId}/`)) throw new AppError(400, "Invalid file key");

  const record = await prisma.medicalRecord.create({
    data: {
      patientId,
      title: data.title,
      description: data.description,
      fileUrl: data.key,
      uploadedBy: req.user!.id,
    },
  });
  res.status(201).json({ success: true, data: record });
};

export const listRecords = async (req: Request, res: Response) => {
  const q = z.object({ patientId: z.string().optional() }).parse(req.query);
  const patientId = await resolvePatientId(req, q.patientId);

  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    select: { id: true, title: true, description: true, uploadedBy: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: records });
};

export const getDownloadUrl = async (req: Request, res: Response) => {
  const record = await prisma.medicalRecord.findUnique({ where: { id: String(req.params.id) } });
  if (!record) throw new AppError(404, "Record not found");
  if (!(await canAccessPatient(req.user!, record.patientId))) throw new AppError(403, "No access");

  res.json({ success: true, data: { downloadUrl: await createDownloadUrl(record.fileUrl), expiresInSeconds: 300 } });
};

export const deleteRecord = async (req: Request, res: Response) => {
  const record = await prisma.medicalRecord.findUnique({ where: { id: String(req.params.id) } });
  if (!record) throw new AppError(404, "Record not found");
  if (!(await canAccessPatient(req.user!, record.patientId))) throw new AppError(403, "No access");

  await prisma.medicalRecord.delete({ where: { id: record.id } });
  await deleteObject(record.fileUrl);
  res.json({ success: true, message: "Record deleted" });
};