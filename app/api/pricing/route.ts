import { auth } from "@/auth";
import { resolveSalePrice } from "@/lib/sales-pricing";
import { z } from "zod";

const schema=z.object({productType:z.enum(["E_CPF","E_CNPJ","E_PF","E_PJ"]),certificateType:z.enum(["A1","A3"]),a3Model:z.enum(["TOKEN","CARTAO","NUVEM"]).optional()});
export async function GET(request:Request){if(!(await auth())?.user?.email)return Response.json({error:{message:"Não autenticado."}},{status:401});const url=new URL(request.url);const parsed=schema.safeParse({productType:url.searchParams.get("productType"),certificateType:url.searchParams.get("certificateType"),a3Model:url.searchParams.get("a3Model")||undefined});if(!parsed.success)return Response.json({error:{message:"Dados de preço inválidos."}},{status:400});const price=await resolveSalePrice(parsed.data.productType,parsed.data.certificateType,parsed.data.certificateType==="A3"?parsed.data.a3Model:null,new Date());return Response.json({success:true,data:{amount:price?Number(price.amount):null}})}
