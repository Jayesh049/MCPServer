/**
 * Demo platform users (optional):
 *   npx tsx prisma/seedPlatform.ts
 *
 * Doctor: doctor@demo.com / demo1234
 * Patient: patient@demo.com / demo1234
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const hash = await bcrypt.hash("demo1234", 10);

  await prisma.platformUser.upsert({
    where: { email: "doctor@demo.com" },
    create: {
      email: "doctor@demo.com",
      passwordHash: hash,
      name: "Dr. Arjun Sharma",
      role: "DOCTOR",
      doctor: {
        create: {
          specialty: "Hepatologist",
          regNo: "MCI-DEMO-001",
          hospital: "AIIMS Delhi",
          experience: 12,
          verified: true,
          rating: 4.9,
        },
      },
    },
    update: {},
  });

  await prisma.platformUser.upsert({
    where: { email: "patient@demo.com" },
    create: {
      email: "patient@demo.com",
      passwordHash: hash,
      name: "Priya Rajan",
      role: "PATIENT",
      patient: {
        create: {
          age: 28,
          city: "Delhi",
          conditions: ["Type 2 Diabetes"],
          allergies: [],
        },
      },
    },
    update: {},
  });

  process.stderr.write("[seedPlatform] doctor@demo.com / patient@demo.com — password: demo1234\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
