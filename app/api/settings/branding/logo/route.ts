import { requireAdmin } from "@/lib/permissions";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
export const runtime = "nodejs";
const accepted = new Map([["image/png", ".png"], ["image/jpeg", ".jpeg"], ["image/svg+xml", ".svg"]]);
export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: { message: "Acesso restrito a administradores." } }, { status: 403 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: { message: "Selecione um arquivo de imagem." } }, { status: 400 });
  const extension = accepted.get(file.type);
  if (!extension) return Response.json({ error: { message: "Formato inválido. Envie PNG, JPEG ou SVG." } }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ error: { message: "O logotipo deve ter no máximo 2 MB." } }, { status: 400 });
  const directory = path.join(process.cwd(), "public", "uploads", "branding"); await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${extension}`; await writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()));
  return Response.json({ success: true, data: { logoUrl: `/uploads/branding/${filename}` } });
}
