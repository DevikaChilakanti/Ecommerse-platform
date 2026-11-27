import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to seed role records.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.role.upsert({
      where: { code: "CUSTOMER" },
      update: { name: "Customer", description: "Standard customer account" },
      create: {
        code: "CUSTOMER",
        name: "Customer",
        description: "Standard customer account",
      },
    });
    await prisma.role.upsert({
      where: { code: "ADMIN" },
      update: { name: "Administrator", description: "Administrator account" },
      create: {
        code: "ADMIN",
        name: "Administrator",
        description: "Administrator account",
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main();
