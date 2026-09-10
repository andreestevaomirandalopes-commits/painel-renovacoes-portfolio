import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
export async function PATCH(request:Request){const session=await auth();if(!session?.user?.email)return Response.json({error:{message:"Não autenticado."}},{status:401});const parsed=z.object({name:z.string().min(2),imageUrl:z.string().nullable().optional()}).safeParse(await request.json());if(!parsed.success)return Response.json({error:{message:"Dados inválidos."}},{status:400});const user=await prisma.user.update({where:{email:session.user.email},data:parsed.data});return Response.json({success:true,data:user})}
