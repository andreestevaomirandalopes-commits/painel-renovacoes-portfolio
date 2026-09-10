import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
const logoUrl = z.string().refine(value => value === "" || /^https?:\/\//.test(value) || /^\/uploads\/branding\/[a-z0-9-]+\.(png|jpeg|svg)$/i.test(value), "URL do logotipo inválida.");
const schema = z.object({ brandName: z.string().min(2).max(60), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), sidebarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoUrl });
export async function PATCH(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: { message: "Acesso restrito a administradores." } }, { status: 403 });
  const parsed=schema.safeParse(await request.json()); if(!parsed.success) return Response.json({ error:{message:"Confira o nome, as cores e o endereço do logotipo."}},{status:400});
  const data={...parsed.data,logoUrl:parsed.data.logoUrl||null}; await prisma.appSettings.upsert({where:{id:"default"},create:{id:"default",...data},update:data});
  return Response.json({success:true,data});
}
