import { EmissionDateImportItemStatus, type Client, type CertificateType } from "@prisma/client";
import { expirationFromEmissionDate } from "@/lib/certificates";
import { canonicalOrderNumber, formatCalendarDate, type EmissionDateSourceRow } from "@/lib/spreadsheet/emission-dates";

export type EmissionDateClientSnapshot = Pick<Client, "id" | "orderNumber" | "certificateType" | "issuedAt" | "expirationDate" | "renewalStage" | "status">;

export type PreparedEmissionDateItem = {
  sourceLine: number;
  sourceOrderNumber: string;
  matchedOrderNumber: string | null;
  clientId: string | null;
  sourceIssuedAt: Date | null;
  sourceExpirationDate: Date | null;
  previousIssuedAt: Date | null;
  previousExpirationDate: Date | null;
  calculatedExpirationDate: Date | null;
  status: EmissionDateImportItemStatus;
  message: string;
};

export const sameCalendarDate = (left: Date | null | undefined, right: Date | null | undefined) => formatCalendarDate(left) === formatCalendarDate(right);

function messageForCalculatedExpiration(certificateType: CertificateType, date: Date) {
  return `Vencimento calculado em ${date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} conforme certificado ${certificateType}.`;
}

/**
 * Classifica cada linha sem criar ou alterar nenhum pedido. A aplicação final
 * reexecuta esta regra com os dados atuais para evitar sobrescrever uma edição
 * feita entre a prévia e a confirmação.
 */
export function prepareEmissionDateImport(rows: EmissionDateSourceRow[], clients: EmissionDateClientSnapshot[]): PreparedEmissionDateItem[] {
  const sourceCount = new Map<string, number>();
  for (const row of rows) {
    if (row.orderNumber) {
      const key = canonicalOrderNumber(row.orderNumber);
      sourceCount.set(key, (sourceCount.get(key) || 0) + 1);
    }
  }

  const clientsByOrder = new Map<string, EmissionDateClientSnapshot[]>();
  for (const client of clients) {
    const key = canonicalOrderNumber(client.orderNumber);
    const matches = clientsByOrder.get(key) || [];
    matches.push(client);
    clientsByOrder.set(key, matches);
  }

  return rows.map((row): PreparedEmissionDateItem => {
    const base = {
      sourceLine: row.line,
      sourceOrderNumber: row.orderNumber,
      matchedOrderNumber: null,
      clientId: null,
      sourceIssuedAt: row.issuedAt,
      sourceExpirationDate: row.sourceExpirationDate,
      previousIssuedAt: null,
      previousExpirationDate: null,
      calculatedExpirationDate: null,
    };
    if (row.errors.length) return { ...base, status: EmissionDateImportItemStatus.DATA_INVALIDA, message: row.errors.join("; ") };

    const canonical = canonicalOrderNumber(row.orderNumber);
    if ((sourceCount.get(canonical) || 0) > 1) return { ...base, status: EmissionDateImportItemStatus.PEDIDO_REPETIDO, message: "Pedido repetido na própria planilha; nenhuma das linhas será alterada." };

    const matches = clientsByOrder.get(canonical) || [];
    if (!matches.length) return { ...base, status: EmissionDateImportItemStatus.PEDIDO_NAO_ENCONTRADO, message: "Pedido não encontrado no painel; nenhum cadastro será criado." };
    if (matches.length > 1) return { ...base, status: EmissionDateImportItemStatus.PEDIDO_AMBIGUO, message: "Há mais de um pedido compatível no painel; revise antes de alterar." };

    const client = matches[0];
    const calculatedExpirationDate = expirationFromEmissionDate(row.issuedAt!, client.certificateType);
    const details = {
      ...base,
      matchedOrderNumber: client.orderNumber,
      clientId: client.id,
      previousIssuedAt: client.issuedAt,
      previousExpirationDate: client.expirationDate,
      calculatedExpirationDate,
    };

    if (row.sourceExpirationDate && !sameCalendarDate(row.sourceExpirationDate, calculatedExpirationDate)) {
      return { ...details, status: EmissionDateImportItemStatus.VENCIMENTO_DIVERGENTE, message: `O vencimento informado na planilha (${formatCalendarDate(row.sourceExpirationDate)}) diverge do cálculo pela emissão. Revise a linha manualmente.` };
    }
    if (client.renewalStage === "RENOVADO" || client.status === "RENOVADO") {
      return { ...details, status: EmissionDateImportItemStatus.PEDIDO_RENOVADO, message: "Pedido já marcado como renovado; o histórico não será alterado pela planilha." };
    }
    if (sameCalendarDate(client.issuedAt, row.issuedAt) && sameCalendarDate(client.expirationDate, calculatedExpirationDate)) {
      return { ...details, status: EmissionDateImportItemStatus.SEM_ALTERACAO, message: "A data de emissão e o vencimento já estão atualizados." };
    }
    return { ...details, status: EmissionDateImportItemStatus.ATUALIZAR, message: messageForCalculatedExpiration(client.certificateType, calculatedExpirationDate) };
  });
}

export function emissionDateImportSummary(items: PreparedEmissionDateItem[]) {
  return {
    updateCount: items.filter((item) => item.status === EmissionDateImportItemStatus.ATUALIZAR).length,
    unchangedCount: items.filter((item) => item.status === EmissionDateImportItemStatus.SEM_ALTERACAO).length,
    pendingCount: items.filter((item) => item.status !== EmissionDateImportItemStatus.ATUALIZAR && item.status !== EmissionDateImportItemStatus.SEM_ALTERACAO).length,
  };
}
