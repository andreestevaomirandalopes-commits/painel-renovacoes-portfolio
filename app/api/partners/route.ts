import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
const schema=z.object({officeName:z.string().min(2,"Informe o nome do escritório."),email:z.string().email("E-mail inválido"),revCode:z.string().min(1,"Código REV é obrigatório")});
export async function POST(request:Request){if(!(await auth())?.user?.email)return Response.json({error:{message:"Não autenticado."}},{status:401});const parsed=schema.safeParse(await request.json());if(!parsed.success)return Response.json({error:{message:parsed.error.issues[0].message}},{status:400});try{const partner=await prisma.partner.create({data:parsed.data});return Response.json({success:true,data:partner},{status:201})}catch{return Response.json({error:{message:"E-mail ou Código REV já cadastrado."}},{status:409})}}
