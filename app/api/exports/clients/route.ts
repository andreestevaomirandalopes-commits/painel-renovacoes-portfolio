import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { expirationDate: "asc" } });
  const rows = clients.map(c => ({ "Número do pedido": c.orderNumber, Cliente: c.name || "", "Tipo do produto": c.productType, CPF: c.cpf, CNPJ: c.cnpj || "", "Tipo de certificado": c.certificateType, "Modelo A3": c.a3Model || "", "Data de compra": c.purchaseDate?.toISOString().slice(0,10) || "", "Data de emissão": c.issuedAt?.toISOString().slice(0,10) || "", "Data de vencimento": c.expirationDate.toISOString().slice(0,10), "E-mail": c.email, Telefone: c.phone || "", Status: c.status }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Renovações");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename=renovacoes-${new Date().toISOString().slice(0,10)}.xlsx` } });
}
