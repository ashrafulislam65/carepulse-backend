import { prisma } from "./prisma";
import { AppError } from "../utils/errors";

export const getOwnPatient = async (userId: string) => {
  const patient = await prisma.patientProfile.findUnique({ where: { userId } });
  if (!patient) throw new AppError(404, "Patient profile not found");
  return patient;
};