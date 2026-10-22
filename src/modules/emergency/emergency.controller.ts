import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { resolveQrToken } from "../../lib/qr";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { signToken, verifyToken } from "../../utils/tokens";

// Public layer: login lagbe na
export const getPublicProfile = async (req: Request, res: Response) => {
  const profile = await resolveQrToken(String(req.params.token));
  const contacts = await prisma.emergencyContact.findMany({
    where: { patientId: profile.id },
    select: { name: true, relationship: true, phoneNumber: true, isPrimary: true },
    orderBy: { isPrimary: "desc" },
  });

  res.json({
    success: true,
    data: {
      firstName: profile.firstName,
      bloodGroup: profile.bloodGroup,
      allergies: profile.allergies,
      chronicConditions: profile.chronicConditions,
      emergencyContacts: contacts,
    },
  });
};

// PIN diye 15 min-er unlock token
export const unlock = async (req: Request, res: Response) => {
  const { pin } = z.object({ pin: z.string().min(4).max(6) }).parse(req.body);
  const profile = await resolveQrToken(String(req.params.token));

  const ok = profile.emergencyPin && (await bcrypt.compare(pin, profile.emergencyPin));
  if (!ok) throw new AppError(401, "Invalid PIN");

  const unlockToken = signToken({ typ: "unlock", pid: profile.id }, env.UNLOCK_TOKEN_EXPIRES_IN);
  res.json({ success: true, data: { unlockToken, expiresIn: env.UNLOCK_TOKEN_EXPIRES_IN } });
};

// Protected layer: DOCTOR/RESPONDER/ADMIN-er login token ba PIN unlock token
export const getFullProfile = async (req: Request, res: Response) => {
  const profile = await resolveQrToken(String(req.params.token));

  let allowed = false;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const p = verifyToken<{ sub?: string; role?: string }>(header.slice(7));
      allowed = !!p.sub && ["DOCTOR", "RESPONDER", "ADMIN"].includes(p.role ?? "");
    } catch {
      /* ignore */
    }
  }

  if (!allowed) {
    const unlockToken = req.headers["x-unlock-token"];
    if (typeof unlockToken === "string") {
      try {
        const p = verifyToken<{ typ: string; pid: string }>(unlockToken);
        allowed = p.typ === "unlock" && p.pid === profile.id;
      } catch {
        /* ignore */
      }
    }
  }

  if (!allowed) throw new AppError(403, "Responder login or valid PIN required");

  const full = await prisma.patientProfile.findUnique({
    where: { id: profile.id },
    include: {
      emergencyContacts: true,
      medicalRecords: { select: { id: true, title: true, description: true, createdAt: true } },
    },
  });
  const { emergencyPin, qrAccessCode, ...safe } = full!;
  res.json({ success: true, data: safe });
};