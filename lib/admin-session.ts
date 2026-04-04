import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminToken, type AdminJwtPayload } from "@/lib/admin-token";

export async function getAdminSession(): Promise<AdminJwtPayload | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
