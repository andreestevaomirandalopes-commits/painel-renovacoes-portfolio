import type { ReconciliationPreparedItem } from "@/lib/reconciliation";
import { prepareCertisignReconciliation } from "@/lib/reconciliation-import";
import { certisignPartnerCommissionHeadersMissing, readCertisignWorkbook } from "@/lib/spreadsheet/certisign-reconciliation";

export const partnerCommissionStatusInfo = {
  COMISSAO_ADICIONADA: { label: "Comissão adicionada", className: "bg-emerald-100 text-emerald-700" },
  CONFERIDO: { label: "Já conferido", className: "bg-emerald-50 text-emerald-700" },
  PENDENTE_ADICAO: { label: "Pronto para adicionar", className: "bg-sky-100 text-sky-700" },
  AGUARDANDO_MAPEAMENTO: { label: "Escolher parceiro", className: "bg-amber-100 text-amber-800" },
  PARCEIRO_DIFERENTE: { label: "Parceiro diferente", className: "bg-rose-100 text-rose-700" },
  VALOR_DIVERGENTE: { label: "Comissão divergente", className: "bg-rose-100 text-rose-700" },
  SEM_VALOR: { label: "Sem valor no painel", className: "bg-rose-100 text-rose-700" },
  SEM_DATA_COMPRA: { label: "Sem data de compra", className: "bg-rose-100 text-rose-700" },
  PEDIDO_FORA_COMPETENCIA: { label: "Pedido em outro mês", className: "bg-rose-100 text-rose-700" },
  SOMENTE_CERTISIGN: { label: "Somente Certisign", className: "bg-violet-100 text-violet-700" },
  NAO_REMUNERADO: { label: "Sem comissão", className: "bg-slate-100 text-slate-600" },
  MES_FECHADO: { label: "Mês fechado", className: "bg-slate-100 text-slate-600" },
  SEM_CODIGO_VENDEDOR: { label: "Sem código de vendedor", className: "bg-rose-100 text-rose-700" },
} as const;

export type PartnerCommissionStatus = keyof typeof partnerCommissionStatusInfo;

export type PartnerReference = { id: string; officeName: string; revCode: string };
export type PartnerCommissionClient = {
  id: string;
  purchaseDate: Date | null;
  estimatedValue: number | string | { toString(): string } | null;
  partner: PartnerReference | null;
};

export type PartnerCommissionAssessment = {
  status: PartnerCommissionStatus;
  message: string;
  expectedCommission: number | null;
  suggestedPartner: PartnerReference | null;
  hasSavedMapping: boolean;
  canApply: boolean;
};

const cents = (value: number) => Math.round(value * 100);
const sameMoney = (left: number, right: number) => cents(left) === cents(right);
const numberValue = (value: PartnerCommissionClient["estimatedValue"]) => {
  if (value === null || value === undefined) return null;
  const result = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : null;
};

function sameCompetence(date: Date, competence: Date) {
  return date.getUTCFullYear() === competence.getUTCFullYear() && date.getUTCMonth() === competence.getUTCMonth();
}

export function expectedPartnerCommission(value: PartnerCommissionClient["estimatedValue"]) {
  const sourceValue = numberValue(value);
  return sourceValue === null ? null : Math.round(sourceValue * 10) / 100;
}

export function assessPartnerCommission(input: {
  externalCommission: number | null;
  externalVendorCode: string | null;
  client: PartnerCommissionClient | null;
  competence: Date;
  partnerByExternalCode: PartnerReference | null;
  hasSavedMapping: boolean;
  financialMonthClosed: boolean;
  commissionAppliedAt?: Date | null;
}) : PartnerCommissionAssessment {
  const commission = input.externalCommission;
  if (commission === null || commission <= 0) return { status: "NAO_REMUNERADO", message: "Voucher, reembolso ou linha sem comissão a pagar.", expectedCommission: null, suggestedPartner: null, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (!input.client) return { status: "SOMENTE_CERTISIGN", message: "O pedido não foi encontrado no painel; nenhuma venda será criada por esta importação.", expectedCommission: null, suggestedPartner: null, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (!input.client.purchaseDate) return { status: "SEM_DATA_COMPRA", message: "O pedido no painel não possui data de compra para esta competência.", expectedCommission: null, suggestedPartner: null, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (!sameCompetence(input.client.purchaseDate, input.competence)) return { status: "PEDIDO_FORA_COMPETENCIA", message: "O pedido existe, mas está cadastrado em outra competência mensal.", expectedCommission: null, suggestedPartner: null, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (!input.externalVendorCode) return { status: "SEM_CODIGO_VENDEDOR", message: "A planilha não informou o código de vendedor Certisign.", expectedCommission: null, suggestedPartner: null, hasSavedMapping: input.hasSavedMapping, canApply: false };

  const expectedCommission = expectedPartnerCommission(input.client.estimatedValue);
  if (expectedCommission === null) return { status: "SEM_VALOR", message: "O pedido não possui valor registrado no painel para calcular 10%.", expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (!sameMoney(commission, expectedCommission)) return { status: "VALOR_DIVERGENTE", message: `A Certisign informa R$ ${commission.toFixed(2)}; o painel calcula R$ ${expectedCommission.toFixed(2)} (10%).`, expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: false };

  if (!input.partnerByExternalCode) return { status: "AGUARDANDO_MAPEAMENTO", message: "Escolha o parceiro correto para confirmar o vínculo deste código de vendedor da Certisign.", expectedCommission, suggestedPartner: null, hasSavedMapping: false, canApply: !input.financialMonthClosed };
  if (input.client.partner && input.client.partner.id !== input.partnerByExternalCode.id) return { status: "PARCEIRO_DIFERENTE", message: `O pedido já está vinculado a ${input.client.partner.officeName}; a conciliação não substitui parceiros existentes.`, expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: false };
  if (input.client.partner?.id === input.partnerByExternalCode.id) {
    return { status: input.commissionAppliedAt ? "COMISSAO_ADICIONADA" : "CONFERIDO", message: input.commissionAppliedAt ? "Parceiro vinculado por esta conciliação; a comissão de 10% já aparece no mês." : "O pedido já está vinculado ao parceiro correto; a comissão já está no painel.", expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: false };
  }
  if (input.financialMonthClosed) return { status: "MES_FECHADO", message: "O mês financeiro está fechado; não é seguro vincular comissão agora.", expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: false };
  return { status: "PENDENTE_ADICAO", message: "O pedido ainda não tem parceiro. Você pode vinculá-lo e incluir a comissão de 10%.", expectedCommission, suggestedPartner: input.partnerByExternalCode, hasSavedMapping: input.hasSavedMapping, canApply: true };
}

export async function preparePartnerCommissionReconciliation(file: File, competence: Date) {
  const buffer = await file.arrayBuffer();
  const { rows } = readCertisignWorkbook(buffer);
  const missing = certisignPartnerCommissionHeadersMissing(rows);
  if (missing.length) throw new Error(`Colunas obrigatórias não reconhecidas: ${missing.join(", ")}.`);

  const prepared = await prepareCertisignReconciliation(file, competence);
  const items = prepared.items
    .filter((item) => /^\d{8}$/.test(item.externalOrderNumber || ""))
    // Nunca guardar a área de resumo da planilha ou possíveis chaves PIX nela.
    .map((item) => ({ ...item, rawData: null } satisfies ReconciliationPreparedItem));
  const externalCommissionTotal = items.reduce((total, item) => total + Number(item.externalCommissionAmount || 0), 0);
  return {
    ...prepared,
    items,
    totalItems: items.length,
    externalCommissionTotal: Math.round(externalCommissionTotal * 100) / 100,
    remuneratedItems: items.filter((item) => Number(item.externalCommissionAmount || 0) > 0).length,
  };
}

export function partnerCommissionPreviewItem(item: ReconciliationPreparedItem, assessment: PartnerCommissionAssessment) {
  return {
    sourceLine: item.sourceLine,
    externalOrderNumber: item.externalOrderNumber,
    externalVendorCode: item.externalVendorCode,
    externalVendorName: item.externalVendorName,
    externalCommissionAmount: item.externalCommissionAmount,
    systemClientName: item.systemClientName,
    systemPartnerRevCode: item.systemPartnerRevCode,
    expectedCommission: assessment.expectedCommission,
    status: assessment.status,
    message: assessment.message,
  };
}
