import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClientForm } from "@/components/clients/client-form";
import { prisma } from "@/lib/prisma";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } }) : null;
  if (user?.role !== "SUPER_ADMIN") redirect("/clientes");
  const [client, partners] = await Promise.all([prisma.client.findUnique({ where: { id: (await params).id } }), prisma.partner.findMany({ select: { id: true, officeName: true, revCode: true }, orderBy: { officeName: "asc" } })]);
  if (!client) notFound();
  return <><div className="flex items-center gap-4 mb-6"><Link href="/clientes" className="text-sm brand-text">← Voltar</Link><div><h2 className="text-2xl font-bold">Editar cliente</h2><p className="text-sm text-slate-500">Área exclusiva do Proprietário.</p></div></div><ClientForm partners={partners} client={{...client,estimatedValue:client.estimatedValue?Number(client.estimatedValue):null}}/></>;
}
