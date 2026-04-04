import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

export async function getAdminOperator() {
  const session = await getAdminSession();
  if (!session) return null;
  const user = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!user) return null;
  return { session, user };
}

/** `firmId === null` = platform operator (all firms). */
export async function assertFirmAccess(firmId: string) {
  const op = await getAdminOperator();
  if (!op) throw new Error("Unauthorized");
  if (op.user.firmId != null && op.user.firmId !== firmId) {
    throw new Error("Forbidden");
  }
  return op;
}
