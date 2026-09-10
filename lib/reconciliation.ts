import { A3Model, CertificateType, ComparisonStatus, ProductType, ReconciliationStatus } from "@prisma/client";
import type { CertisignReconciliationRow } from "@/lib/spreadsheet/certisign-reconciliation";

type DecimalLike = number | string | { toString(): string } | null;

export type ReconciliationClient = {
  id: string;
  orderNumber: string;
  name: string | null;
  legalName: string | null;
  cpf: string;
  cnpj: string | null;
  productType: ProductType;
  certificateType: CertificateType;
  a3Model: A3Model | null;
  estimatedValue: DecimalLike;
  partner: { revCode: string; officeName: string } | null;
};

export type ReconciliationDifference = {
  field: "VALOR" | "PRODUTO" | "PARCEIRO" | "PEDIDO" | "IMPORTACAO";
  kind: "DIFERENCA" | "INFORMACAO";
  message: string;
  expected?: string;
  actual?: string;
};

export type ReconciliationPreparedItem = {
  sourceLine: number | null;
  clientId: string | null;
  externalOrderNumber: string | null;
  externalEntityCode: string | null;
  externalEntityName: string | null;
  externalVendorCode: string | null;
  externalVendorName: string | null;
  externalProductCode: string | null;
  externalProductName: string | null;
  externalOrderStatus: string | null;
  externalOrderDate: Date | null;
  externalRenewalDate: Date | null;
  externalPreviousOrder: string | null;
  externalClientName: string | null;
  externalVoucherType: string | null;
  externalGrossAmount: number | null;
  externalBillingAmount: number | null;
  externalCommissionAmount: number | null;
  externalCount: number | null;
  rawData: Record<string, string> | null;
  systemOrderNumber: string | null;
  systemClientName: string | null;
  systemCpf: string | null;
  systemCnpj: string | null;
  systemValue: number | null;
  systemProductType: ProductType | null;
  systemCertificateType: CertificateType | null;
  systemA3Model: A3Model | null;
  systemPartnerRevCode: string | null;
  systemPartnerName: string | null;
  status: ReconciliationStatus;
  valueStatus: ComparisonStatus;
  productStatus: ComparisonStatus;
  partnerStatus: ComparisonStatus;
  differences: ReconciliationDifference[];
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const nullable = (value: string) => value.trim() || null;
const decimalNumber = (value: DecimalLike) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};
const sameMoney = (left: number, right: number) => Math.round(left * 100) === Math.round(right * 100);

function systemSnapshot(client: ReconciliationClient | null) {
  return {
    clientId: client?.id || null,
    systemOrderNumber: client?.orderNumber || null,
    systemClientName: client?.name || client?.legalName || null,
    systemCpf: client?.cpf || null,
    systemCnpj: client?.cnpj || null,
    systemValue: decimalNumber(client?.estimatedValue ?? null),
    systemProductType: client?.productType || null,
    systemCertificateType: client?.certificateType || null,
    systemA3Model: client?.a3Model || null,
    systemPartnerRevCode: client?.partner?.revCode || null,
    systemPartnerName: client?.partner?.officeName || null,
  };
}

function sourceSnapshot(row: CertisignReconciliationRow | null) {
  return {
    sourceLine: row?.line ?? null,
    externalOrderNumber: row ? nullable(row.orderNumber) : null,
    externalEntityCode: row ? nullable(row.entityCode) : null,
    externalEntityName: row ? nullable(row.entityName) : null,
    externalVendorCode: row ? nullable(row.vendorCode) : null,
    externalVendorName: row ? nullable(row.vendorName) : null,
    externalProductCode: row ? nullable(row.productCode) : null,
    externalProductName: row ? nullable(row.productName) : null,
    externalOrderStatus: row ? nullable(row.orderStatus) : null,
    externalOrderDate: row?.orderDate ?? null,
    externalRenewalDate: row?.renewalDate ?? null,
    externalPreviousOrder: row ? nullable(row.previousOrder) : null,
    externalClientName: row ? nullable(row.clientName) : null,
    externalVoucherType: row ? nullable(row.voucherType) : null,
    externalGrossAmount: row?.grossAmount ?? null,
    externalBillingAmount: row?.billingAmount ?? null,
    externalCommissionAmount: row?.commissionAmount ?? null,
    externalCount: row?.count ?? null,
    rawData: row?.rawData ?? null,
  };
}

function externalProduct(row: CertisignReconciliationRow) {
  const text = normalize(`${row.productCode} ${row.productName}`);
  const productType = text.includes("e cnpj") ? ProductType.E_CNPJ
    : text.includes("e cpf") ? ProductType.E_CPF
      : text.includes("e pf") ? ProductType.E_PF
        : text.includes("e pj") ? ProductType.E_PJ : null;
  const certificateType = /\ba3\b/.test(text) ? CertificateType.A3 : /\ba1\b/.test(text) ? CertificateType.A1 : null;
  const a3Model = text.includes("token") ? A3Model.TOKEN
    : text.includes("cartao") ? A3Model.CARTAO
      : text.includes("nuvem") ? A3Model.NUVEM : null;
  return { productType, certificateType, a3Model };
}

function compareItem(row: CertisignReconciliationRow, client: ReconciliationClient, knownPartnerCodes: Set<string>) {
  const differences: ReconciliationDifference[] = [];
  let valueStatus: ComparisonStatus = ComparisonStatus.NAO_DISPONIVEL;
  let productStatus: ComparisonStatus = ComparisonStatus.NAO_DISPONIVEL;
  let partnerStatus: ComparisonStatus = ComparisonStatus.NAO_DISPONIVEL;
  const sourceValue = row.billingAmount;
  const systemValue = decimalNumber(client.estimatedValue);
  if (sourceValue !== null && systemValue !== null) {
    if (sameMoney(sourceValue, systemValue)) valueStatus = ComparisonStatus.CONFERE;
    else {
      valueStatus = ComparisonStatus.DIFERENTE;
      differences.push({ field: "VALOR", kind: "DIFERENCA", message: "Valor de faturamento diferente", expected: systemValue.toFixed(2), actual: sourceValue.toFixed(2) });
    }
  } else {
    differences.push({ field: "VALOR", kind: "INFORMACAO", message: "Valor não disponível para comparação automática" });
  }

  const sourceProduct = externalProduct(row);
  if (sourceProduct.productType && sourceProduct.certificateType) {
    const productMismatch = sourceProduct.productType !== client.productType || sourceProduct.certificateType !== client.certificateType || (sourceProduct.a3Model !== null && client.a3Model !== sourceProduct.a3Model);
    if (productMismatch) {
      productStatus = ComparisonStatus.DIFERENTE;
      differences.push({ field: "PRODUTO", kind: "DIFERENCA", message: "Produto ou modelo do certificado diferente", expected: `${client.productType} ${client.certificateType}${client.a3Model ? ` ${client.a3Model}` : ""}`, actual: `${sourceProduct.productType} ${sourceProduct.certificateType}${sourceProduct.a3Model ? ` ${sourceProduct.a3Model}` : ""}` });
    } else productStatus = ComparisonStatus.CONFERE;
  } else {
    differences.push({ field: "PRODUTO", kind: "INFORMACAO", message: "Produto externo não pôde ser identificado com segurança" });
  }

  if (row.vendorCode && client.partner?.revCode) {
    if (knownPartnerCodes.has(row.vendorCode)) {
      if (row.vendorCode === client.partner.revCode) partnerStatus = ComparisonStatus.CONFERE;
      else {
        partnerStatus = ComparisonStatus.DIFERENTE;
        differences.push({ field: "PARCEIRO", kind: "DIFERENCA", message: "Código de parceiro diferente", expected: client.partner.revCode, actual: row.vendorCode });
      }
    } else {
      differences.push({ field: "PARCEIRO", kind: "INFORMACAO", message: "Código de vendedor Certisign preservado, mas sem correspondência automática com um Código REV cadastrado" });
    }
  } else if (!client.partner?.revCode) {
    differences.push({ field: "PARCEIRO", kind: "INFORMACAO", message: "Pedido não possui parceiro vinculado no painel" });
  }

  return { valueStatus, productStatus, partnerStatus, differences };
}

export function prepareReconciliationItems(input: {
  rows: CertisignReconciliationRow[];
  clientsInCompetence: ReconciliationClient[];
  allSourceClients: ReconciliationClient[];
  knownPartnerCodes: Iterable<string>;
}) {
  const knownPartnerCodes = new Set(input.knownPartnerCodes);
  const currentByOrder = new Map(input.clientsInCompetence.map((client) => [client.orderNumber, client]));
  const allByOrder = new Map(input.allSourceClients.map((client) => [client.orderNumber, client]));
  const sourceOrders = new Set<string>();
  const prepared: ReconciliationPreparedItem[] = [];

  for (const row of input.rows) {
    const source = sourceSnapshot(row);
    if (row.ignored) {
      prepared.push({ ...source, ...systemSnapshot(null), status: ReconciliationStatus.IGNORADO, valueStatus: ComparisonStatus.NAO_DISPONIVEL, productStatus: ComparisonStatus.NAO_DISPONIVEL, partnerStatus: ComparisonStatus.NAO_DISPONIVEL, differences: [{ field: "IMPORTACAO", kind: "INFORMACAO", message: "Linha de totalização ou resumo preservada sem conciliar como pedido" }] });
      continue;
    }
    if (row.orderNumber) sourceOrders.add(row.orderNumber);
    const inCompetence = currentByOrder.get(row.orderNumber);
    const foundOutsideCompetence = !inCompetence ? allByOrder.get(row.orderNumber) : null;
    if (!row.valid || row.requiresManualReview) {
      const client = inCompetence || foundOutsideCompetence || null;
      const differences: ReconciliationDifference[] = row.messages.map((message) => ({ field: "IMPORTACAO", kind: "DIFERENCA", message }));
      if (foundOutsideCompetence) differences.push({ field: "PEDIDO", kind: "DIFERENCA", message: "Pedido existe no painel, mas em outra competência mensal" });
      prepared.push({ ...source, ...systemSnapshot(client), status: ReconciliationStatus.REVISAO_MANUAL, valueStatus: ComparisonStatus.NAO_DISPONIVEL, productStatus: ComparisonStatus.NAO_DISPONIVEL, partnerStatus: ComparisonStatus.NAO_DISPONIVEL, differences });
      continue;
    }
    if (!inCompetence) {
      if (foundOutsideCompetence) {
        prepared.push({ ...source, ...systemSnapshot(foundOutsideCompetence), status: ReconciliationStatus.REVISAO_MANUAL, valueStatus: ComparisonStatus.NAO_DISPONIVEL, productStatus: ComparisonStatus.NAO_DISPONIVEL, partnerStatus: ComparisonStatus.NAO_DISPONIVEL, differences: [{ field: "PEDIDO", kind: "DIFERENCA", message: "Pedido existe no painel, mas em outra competência mensal" }] });
      } else {
        prepared.push({ ...source, ...systemSnapshot(null), status: ReconciliationStatus.SOMENTE_CERTISIGN, valueStatus: ComparisonStatus.NAO_DISPONIVEL, productStatus: ComparisonStatus.NAO_DISPONIVEL, partnerStatus: ComparisonStatus.NAO_DISPONIVEL, differences: [{ field: "PEDIDO", kind: "DIFERENCA", message: "Pedido consta somente na planilha Certisign" }] });
      }
      continue;
    }
    const compared = compareItem(row, inCompetence, knownPartnerCodes);
    const hasDifference = [compared.valueStatus, compared.productStatus, compared.partnerStatus].includes(ComparisonStatus.DIFERENTE);
    prepared.push({ ...source, ...systemSnapshot(inCompetence), status: hasDifference ? ReconciliationStatus.DIVERGENTE : ReconciliationStatus.CONFERIDO, ...compared });
  }

  for (const client of input.clientsInCompetence) {
    if (sourceOrders.has(client.orderNumber)) continue;
    prepared.push({ ...sourceSnapshot(null), ...systemSnapshot(client), status: ReconciliationStatus.SOMENTE_PAINEL, valueStatus: ComparisonStatus.NAO_DISPONIVEL, productStatus: ComparisonStatus.NAO_DISPONIVEL, partnerStatus: ComparisonStatus.NAO_DISPONIVEL, differences: [{ field: "PEDIDO", kind: "DIFERENCA", message: "Pedido consta somente no painel para esta competência" }] });
  }
  return prepared;
}

export function reconciliationSummary(items: ReconciliationPreparedItem[]) {
  return Object.fromEntries(Object.values(ReconciliationStatus).map((status) => [status, items.filter((item) => item.status === status).length])) as Record<ReconciliationStatus, number>;
}
