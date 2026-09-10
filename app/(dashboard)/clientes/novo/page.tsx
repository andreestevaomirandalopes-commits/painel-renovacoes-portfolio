import { ClientForm } from "@/components/clients/client-form";
import { prisma } from "@/lib/prisma";
export default async function NewClient(){const partners=await prisma.partner.findMany({select:{id:true,officeName:true,revCode:true},orderBy:{officeName:"asc"}});return <><h2 className="text-2xl font-bold mb-6">Cadastrar cliente</h2><ClientForm partners={partners}/></>}
