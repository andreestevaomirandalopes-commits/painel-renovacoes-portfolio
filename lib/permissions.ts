import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, active: true } });
  return user?.active && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? user : null;
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, active: true } });
  return user?.active && user.role === "SUPER_ADMIN" ? user : null;
}
