import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.coerce.date(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signToken = (id: string, role: string) =>
  jwt.sign({ sub: id, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });

// Self-register shudhu PATIENT account banay
export const register = async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new AppError(409, "Email already registered");

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: "PATIENT",
      patientProfile: {
        create: {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          bloodGroup: data.bloodGroup,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    data: {
      token: signToken(user.id, user.role),
      user: { id: user.id, email: user.email, role: user.role },
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const ok = user && (await bcrypt.compare(data.password, user.passwordHash));
  if (!user || !ok) throw new AppError(401, "Invalid email or password");

  res.json({
    success: true,
    data: {
      token: signToken(user.id, user.role),
      user: { id: user.id, email: user.email, role: user.role },
    },
  });
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, role: true, patientProfile: true, doctorProfile: true },
  });
  if (!user) throw new AppError(404, "User not found");
  res.json({ success: true, data: user });
};