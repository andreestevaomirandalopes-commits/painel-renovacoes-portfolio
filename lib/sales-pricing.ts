import type { A3Model, CertificateType, ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export async function resolveSalePrice(productType:ProductType,certificateType:CertificateType,a3Model:A3Model|null|undefined,date=new Date()){const where={productType,certificateType,a3Model:certificateType==="A3"?(a3Model||null):null,active:true,effectiveFrom:{lte:date},OR:[{effectiveTo:null},{effectiveTo:{gte:date}}]};const rule=await prisma.priceRule.findFirst({where,orderBy:{effectiveFrom:"desc"}});return rule?{amount:rule.amount,priceRuleId:rule.id}:null;}
