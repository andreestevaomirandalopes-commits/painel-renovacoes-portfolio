import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validations/client";
import { calculateCertificateStatus } from "@/lib/status";
import { calendarDate, expirationFromEmissionDate } from "@/lib/certificates";
import { resolveSalePrice } from "@/lib/sales-pricing";
import { assertFinancialMonthOpen } from "@/lib/financial-period";
import { audit } from "@/lib/audit";
import { auth } from "@/auth";
import { fail, ok } from "@/lib/api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const take = Math.min(100, Number(searchParams.get("take") || 20));
  const q = searchParams.get("q") || "";
  const where = {
    AND: [
      q ? { OR: [{ orderNumber: { contains: q, mode: "insensitive" as const } }, { cpf: { contains: q } }, { email: { contains: q, mode: "insensitive" as const } }] } : {},
      searchParams.get("productType") ? { productType: searchParams.get("productType") as never } : {},
      searchParams.get("certificateType") ? { certificateType: searchParams.get("certificateType") as never } : {},
      searchParams.get("status") ? { status: searchParams.get("status") as never } : {},
    ],
  };
  const [data, total] = await Promise.all([
    prisma.client.findMany({ where, skip: (page - 1) * take, take, orderBy: { expirationDate: "asc" } }),
    prisma.client.count({ where }),
  ]);
  return ok({ data, total, page, take });
}

export async function POST(req: Request) {
  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0].message);

  try {
    const value = parsed.data;
    const purchaseDate = value.purchaseDate || new Date();
    const issuedAt = value.issuedAt ? calendarDate(value.issuedAt) : null;
    const expirationDate = issuedAt ? expirationFromEmissionDate(issuedAt, value.certificateType) : value.expirationDate;
    await assertFinancialMonthOpen(purchaseDate);

    const price = await resolveSalePrice(value.productType, value.certificateType, value.a3Model, purchaseDate);
    const client = await prisma.client.create({
      data: {
        ...value,
        issuedAt,
        expirationDate,
        purchaseDate,
        cnpj: value.cnpj || null,
        partnerId: value.partnerId || null,
        a3Model: value.certificateType === "A1" ? null : value.a3Model!,
        estimatedValue: value.estimatedValue ?? price?.amount,
        priceRuleId: price?.priceRuleId,
        status: calculateCertificateStatus(expirationDate),
      },
    });
    const session = await auth();
    const actor = session?.user?.email ? (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id : null;
    await audit({
      actorUserId: actor,
      action: "CLIENT_CREATED",
      entity: "Client",
      entityId: client.id,
      details: { orderNumber: client.orderNumber, value: String(client.estimatedValue || ""), issuedAt: client.issuedAt?.toISOString() || null, status: "Adição" },
    });
    return ok(client, 201);
  } catch (error) {
    return fail("CLIENT_CREATE_FAILED", error instanceof Error ? error.message : "Número do pedido já cadastrado", 409);
  }
}
