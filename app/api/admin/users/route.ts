import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: { message: "Acesso restrito a administradores." } }, { status: 403 });
  const data = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(["ADMIN", "OPERADOR"]) }).safeParse(await request.json());
  if (!data.success) return Response.json({ error: { message: "Preencha nome, e-mail, senha (mínimo 8) e perfil." } }, { status: 400 });
  try { const user = await prisma.user.create({ data: { ...data.data, passwordHash: await bcrypt.hash(data.data.password, 12) } }); return Response.json({ success: true, data: { id: user.id } }); } catch { return Response.json({ error: { message: "Já existe um usuário com este e-mail." } }, { status: 409 }); }
}
