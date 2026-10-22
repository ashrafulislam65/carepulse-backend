import { Role } from "@prisma/client";
import { prisma } from "./prisma";

// Ke kon patient-er data dekhte pare
export const canAccessPatient = async (user: { id: string; role: Role }, patientId: string) => {
  if (user.role === "ADMIN") return true;
  if (user.role === "PATIENT") {
    return !!(await prisma.patientProfile.findFirst({ where: { id: patientId, userId: user.id } }));
  }
  if (user.role === "DOCTOR") {
    // doctor shudhu tar nijer appointment-wala patient dekhte pabe
    return !!(await prisma.appointment.findFirst({ where: { patientId, doctor: { userId: user.id } } }));
  }
  return false;
};