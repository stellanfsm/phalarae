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
    },
    update: {
      notificationEmail: process.env.LEAD_ALERT_EMAIL?.trim() || undefined,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "admin@phalerae.local" },
    create: {
      email: "admin@phalerae.local",
      passwordHash,
      firmId: firm.id,
    },
    update: { passwordHash, firmId: firm.id },
  });

  console.log("Seed complete. Firm slug: demo");
  console.log("Admin login: admin@phalerae.local / password from SEED_ADMIN_PASSWORD or default `changeme`");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
