import QRCode from "qrcode";
import { prisma } from "./prisma";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { signToken, verifyToken } from "../utils/tokens";

export const buildQr = async (profile: { id: string; qrTokenVersion: number }) => {
  const token = signToken({ typ: "qr", pid: profile.id, v: profile.qrTokenVersion }, env.QR_TOKEN_EXPIRES_IN);
  const url = `${env.FRONTEND_URL}/emergency/${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  return { token, url, qrDataUrl, expiresIn: env.QR_TOKEN_EXPIRES_IN };
};

// Token valid + version match na korle (revoked) 401
export const resolveQrToken = async (token: string) => {
  let payload: { typ: string; pid: string; v: number };
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, "QR link expired or invalid");
  }
  if (payload.typ !== "qr") throw new AppError(401, "QR link expired or invalid");

  const profile = await prisma.patientProfile.findUnique({ where: { id: payload.pid } });
  if (!profile || profile.qrTokenVersion !== payload.v) {
    throw new AppError(401, "QR link revoked or expired");
  }
  return profile;
};