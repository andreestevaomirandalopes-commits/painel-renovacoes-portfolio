import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";

const adminSchema = z.object({ name:z.string().trim().min(2,"Informe seu nome."), email:z.string().trim().email("Informe um e-mail válido."), password:z.string().min(8,"A senha deve ter ao menos 8 caracteres."), confirmation:z.string() }).refine(data => data.password === data.confirmation, { path:["confirmation"], message:"As senhas não conferem." });

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?:string }> }) {
  const hasUsers = await prisma.user.count(); if (hasUsers > 0) redirect("/login");
  const error = (await searchParams).error;
  async function createAdmin(formData: FormData) { "use server"; const parsed = adminSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) redirect(`/setup?error=${encodeURIComponent(parsed.error.issues[0].message)}`); if (await prisma.user.count() > 0) redirect("/login"); try { await prisma.user.create({ data:{ name:parsed.data.name, email:parsed.data.email.toLowerCase(), passwordHash:await bcrypt.hash(parsed.data.password, 12), role:"ADMIN" } }); } catch { redirect("/setup?error=Não foi possível criar o administrador."); } redirect("/login"); }
  return <main className="min-h-screen grid place-items-center p-5"><form action={createAdmin} className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200 space-y-5"><div><h1 className="text-2xl font-bold">Primeiro acesso</h1><p className="text-slate-500 text-sm mt-1">Crie o administrador do Painel de Renovações.</p></div><label className="block text-sm font-medium">Nome<input name="name" required className="mt-1"/></label><label className="block text-sm font-medium">E-mail<input name="email" type="email" required className="mt-1"/></label><label className="block text-sm font-medium">Senha<input name="password" type="password" minLength={8} required className="mt-1"/></label><label className="block text-sm font-medium">Confirmar senha<input name="confirmation" type="password" minLength={8} required className="mt-1"/></label>{error&&<p className="text-sm text-red-600">{error}</p>}<button className="w-full bg-teal-700 text-white rounded-lg py-2 font-medium">Criar administrador</button></form></main>;
}
