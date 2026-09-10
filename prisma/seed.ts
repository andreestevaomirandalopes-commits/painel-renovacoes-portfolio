import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

async function ensurePriceRule(input: {
  productType: "E_CPF" | "E_CNPJ" | "E_PF" | "E_PJ";
  certificateType: "A1" | "A3";
  a3Model?: "TOKEN" | "CARTAO" | "NUVEM";
  amount: number;
}) {
  const existing = await prisma.priceRule.findFirst({
    where: { productType: input.productType, certificateType: input.certificateType, a3Model: input.a3Model ?? null, active: true },
  });
  return existing ?? prisma.priceRule.create({ data: { ...input, effectiveFrom: new Date(), active: true } });
}

async function main() {
  const passwordHash = await bcrypt.hash("Demo2026!", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@painelgestao.dev" },
    update: {},
    create: { name: "Usuário Demonstração", email: "demo@painelgestao.dev", passwordHash, role: "SUPER_ADMIN" },
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", brandName: "Painel de Gestão", primaryColor: "#0f766e", secondaryColor: "#ffffff", sidebarColor: "#0f172a" },
  });

  const partner = await prisma.partner.upsert({
    where: { email: "parceiro.demo@example.com" },
    update: {},
    create: { officeName: "Escritório Demonstração", email: "parceiro.demo@example.com", revCode: "REV-DEMO" },
  });

  const cpfA1 = await ensurePriceRule({ productType: "E_CPF", certificateType: "A1", amount: 158.87 });
  const cnpjA3 = await ensurePriceRule({ productType: "E_CNPJ", certificateType: "A3", a3Model: "TOKEN", amount: 434.69 });
  const today = new Date();

  await prisma.client.upsert({
    where: { orderNumber: "DEMO-0001" },
    update: {},
    create: {
      orderNumber: "DEMO-0001", name: "Ana Demonstração", legalName: "Ana Demonstração", productType: "E_CPF", cpf: "52998224725", certificateType: "A1",
      purchaseDate: addDays(today, -335), issuedAt: addDays(today, -335), expirationDate: addDays(today, 30), email: "ana.demo@example.com",
      estimatedValue: 158.87, priceRuleId: cpfA1.id, partnerId: partner.id, status: "PROXIMO_VENCIMENTO", renewalStage: "PENDENTE",
    },
  });

  await prisma.client.upsert({
    where: { orderNumber: "DEMO-0002" },
    update: {},
    create: {
      orderNumber: "DEMO-0002", name: "Empresa Demonstração", legalName: "Empresa Demonstração LTDA", productType: "E_CNPJ", cpf: "12345678909", cnpj: "11222333000181",
      certificateType: "A3", a3Model: "TOKEN", purchaseDate: addDays(today, -840), issuedAt: addDays(today, -840), expirationDate: addDays(today, 60),
      email: "contato.demo@example.com", phone: "11999990000", estimatedValue: 434.69, priceRuleId: cnpjA3.id, partnerId: partner.id, status: "ATIVO", renewalStage: "CONTATADO",
    },
  });

  await prisma.cnpjAlert.upsert({
    where: { cnpj: "11222333000181" },
    update: {},
    create: { cnpj: "11222333000181", legalName: "Empresa Demonstração LTDA", tradeName: "Empresa Demo", openingDate: addDays(today, -7), city: "São Paulo", state: "SP", source: "DADOS FICTÍCIOS", status: "EM_ANALISE", email: "contato.demo@example.com" },
  });

  await prisma.auditLog.create({ data: { actorUserId: user.id, action: "DEMO_SEED_CREATED", entity: "Portfolio", details: { message: "Dados fictícios criados para demonstração." } } });
  console.log("Dados fictícios do portfólio criados.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
