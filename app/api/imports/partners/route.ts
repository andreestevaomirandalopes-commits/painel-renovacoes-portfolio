import { fail,ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { PartnerPreviewRow } from "@/lib/spreadsheet/partners";
export async function POST(request:Request){try{const {rows}=await request.json() as {rows?:PartnerPreviewRow[]};if(!Array.isArray(rows)||!rows.length)return fail("INVALID_IMPORT","Nenhum parceiro disponível para importar.");let imported=0,ignored=0;const skipped:{line:number;reason:string}[]=[];for(const row of rows){if(!row.valid||row.duplicate){ignored++;continue;}try{await prisma.partner.create({data:row.values});imported++;}catch{skipped.push({line:row.line,reason:"E-mail ou Código REV já cadastrado"});}}return ok({imported,ignored,skipped});}catch{return fail("IMPORT_FAILED","Não foi possível concluir a importação de parceiros.")}}
