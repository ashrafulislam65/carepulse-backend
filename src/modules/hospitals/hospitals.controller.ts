import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(5),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const listHospitals = async (_req: Request, res: Response) => {
  res.json({ success: true, data: await prisma.hospital.findMany({ orderBy: { name: "asc" } }) });
};

export const createHospital = async (req: Request, res: Response) => {
  const data = schema.parse(req.body);
  res.status(201).json({ success: true, data: await prisma.hospital.create({ data }) });
};