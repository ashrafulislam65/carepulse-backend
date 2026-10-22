import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/errors";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["DOCTOR", "RESPONDER", "ADMIN"]),
    fullName: z.string().min(1).optional(),
    specialty: z.string().min(1).optional(),
    licenseNumber: z.string().min(1).optional(),
    consultationFee: z.number().positive().optional(),
  })
  .refine((d) => d.role !== "DOCTOR" || (d.fullName && d.specialty && d.licenseNumber), {
    message: "fullName, specialty and licenseNumber are required for DOCTOR",
  });

export const createStaffUser = async (req: Request, res: Response) => {
  const d = schema.parse(req.body);

  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    throw new AppError(409, "Email already registered");
  }

  const user = await prisma.user.create({
    data: {
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: d.role,
      ...(d.role === "DOCTOR" && {
        doctorProfile: {
          create: {
            fullName: d.fullName!,
            specialty: d.specialty!,
            licenseNumber: d.licenseNumber!,
            consultationFee: d.consultationFee ?? 500,
          },
        },
      }),
    },
  });

  res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } });
};