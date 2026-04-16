import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await hash(password, 10);

  const firm = await prisma.firm.upsert({
    where: { slug: "demo" },
    create: {
      name: "Demo Injury Law",
      slug: "demo",
      branding: {
        primaryColor: "#1e3a5f",
        displayName: "Demo Injury Law",
      },
      notificationEmail: process.env.LEAD_ALERT_EMAIL?.trim() || null,
      status: "active",
    },
    update: {
      notificationEmail: process.env.LEAD_ALERT_EMAIL?.trim() || undefined,
      status: "active",
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "admin@phalerae.local" },
    create: {
      email: "admin@phalerae.local",
      passwordHash,
      role: "firm_admin",
      firmId: firm.id,
    },
    update: { passwordHash, role: "firm_admin", firmId: firm.id },
  });

  await prisma.adminUser.upsert({
    where: { email: "operator@phalerae.local" },
    create: {
      email: "operator@phalerae.local",
      passwordHash,
      role: "operator",
      firmId: null,
    },
    update: { passwordHash, role: "operator" },
  });

  console.log("Seed complete. Firm slug: demo");
  console.log("Firm admin:  admin@phalerae.local    / SEED_ADMIN_PASSWORD (default: changeme)");
  console.log("Operator:    operator@phalerae.local / SEED_ADMIN_PASSWORD (default: changeme)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
