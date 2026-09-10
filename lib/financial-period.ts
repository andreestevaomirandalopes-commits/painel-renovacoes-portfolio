import { prisma } from "@/lib/prisma";
export const monthStart=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),1);
export async function assertFinancialMonthOpen(date:Date){const close=await prisma.financialClose.findUnique({where:{month:monthStart(date)}});if(close)throw new Error("O mês financeiro desta venda já está fechado. Registre um ajuste por administrador.");}
