import type { Client } from "@prisma/client";
export function renderTemplate(template: string, client: Client) {
  const values: Record<string, string> = { nome: client.name || "", email: client.email, pedido: client.orderNumber, produto: client.productType, cpf: client.cpf, cnpj: client.cnpj || "", vencimento: client.expirationDate.toLocaleDateString("pt-BR"), telefone: client.phone || "" };
  return template.replace(/{{(nome|email|pedido|produto|cpf|cnpj|vencimento|telefone)}}/g, (_, key) => values[key]);
}
