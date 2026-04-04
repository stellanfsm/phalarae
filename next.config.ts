import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma + bcrypt must run as Node externals; bundling (especially Turbopack) breaks queries/auth.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
