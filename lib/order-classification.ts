import { OrderType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizeDocument(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function calendarDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function classifyOrderType(purchaseDate: Date, previousExpirationDate?: Date | null) {
  if (!previousExpirationDate) return OrderType.VENDA_NOVA;
  return calendarDay(purchaseDate) <= calendarDay(previousExpirationDate)
    ? OrderType.RENOVADO
    : OrderType.VENDA_NOVA;
}

export async function classifyOrder(input: {
  cpf: string;
  cnpj?: string | null;
  purchaseDate: Date;
  excludeClientId?: string;
}): Promise<OrderType> {
  const documents = [...new Set([normalizeDocument(input.cpf), normalizeDocument(input.cnpj)].filter(Boolean))];
  if (!documents.length) return OrderType.VENDA_NOVA;

  const documentPredicates = documents.map((document) => Prisma.sql`
    (
      regexp_replace("cpf", '[^0-9]', '', 'g') = ${document}
      OR regexp_replace(COALESCE("cnpj", ''), '[^0-9]', '', 'g') = ${document}
    )
  `);

  const exclusion = input.excludeClientId
    ? Prisma.sql`AND "id" <> ${input.excludeClientId}`
    : Prisma.empty;

  const previousOrders = await prisma.$queryRaw<Array<{ id: string; expirationDate: Date }>>(Prisma.sql`
    SELECT "id", "expirationDate"
    FROM "Client"
    WHERE (${Prisma.join(documentPredicates, " OR ")})
    ${exclusion}
    ORDER BY "expirationDate" DESC, "id" DESC
    LIMIT 1
  `);

  const previousOrder = previousOrders[0];
  return classifyOrderType(input.purchaseDate, previousOrder?.expirationDate);
}
