import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 12);

  await prisma.user.upsert({
    where: { email: "admin@carepulse.test" },
    update: {},
    create: { email: "admin@carepulse.test", passwordHash, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "doctor@carepulse.test" },
    update: {},
    create: {
      email: "doctor@carepulse.test",
      passwordHash,
      role: "DOCTOR",
      doctorProfile: {
        create: { fullName: "Dr. Test Doctor", specialty: "General Medicine", licenseNumber: "BMDC-0001", consultationFee: 500 },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "responder@carepulse.test" },
    update: {},
    create: { email: "responder@carepulse.test", passwordHash, role: "RESPONDER" },
  });

  // Sample hospital (coordinate gulo approximate, nijer moto change koro)
  if ((await prisma.hospital.count()) === 0) {
    await prisma.hospital.createMany({
      data: [
        { name: "Dhaka Medical College Hospital", address: "Secretariat Rd, Dhaka", phone: "+880200000001", latitude: 23.7258, longitude: 90.3976 },
        { name: "Square Hospital", address: "West Panthapath, Dhaka", phone: "+880200000002", latitude: 23.7526, longitude: 90.3814 },
        { name: "Evercare Hospital", address: "Bashundhara R/A, Dhaka", phone: "+880200000003", latitude: 23.8105, longitude: 90.4316 },
      ],
    });
  }
  console.log("Seed done. Password for all test users: Password@123");
}

main().finally(() => prisma.$disconnect());