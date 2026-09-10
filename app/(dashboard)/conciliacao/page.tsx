import { Prisma, ReconciliationKind, ReconciliationReviewStatus, ReconciliationStatus } from "@prisma/client";
import { auth } from "@/auth";
import { ReconciliationActions } from "@/components/reconciliation/reconciliation-actions";
import { ReconciliationImport, ReconciliationStatusBadge } from "@/components/reconciliation/reconciliation-import";
import { TableScroll } from "@/components/layout/table-scroll";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const statusLabel: Record<ReconciliationStatus, string> = {
  CONFERIDO: "Conferido",
  DIVERGENTE: "Com divergência",
  SOMENTE_PAINEL: "Somente no painel",
  SOMENTE_CERTISIGN: "Somente na Certisign",
  REVISAO_MANUAL: "Revisão manual",
  IGNORADO: "Linha ignorada",
};
const reviewLabel: Record<ReconciliationReviewStatus, string> = { PENDENTE: "Pendente", REVISADO: "Revisado", IGNORADO: "Ignorado" };
const asString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";
const money = (value: Prisma.Decimal | number | null) => value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = (value: Date) => value.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function differenceText(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return "—";
  const messages = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const message = item.message;
    return typeof message === "string" ? [message] : [];
  });
  return messages.length ? messages.join(" · ") : "—";
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedRunId = asString(params.lote);
  const q = asString(params.q).trim();
  const requestedStatus = asString(params.status);
  const requestedReview = asString(params.revisao);
  const status = Object.values(ReconciliationStatus).includes(requestedStatus as ReconciliationStatus) ? requestedStatus as ReconciliationStatus : undefined;
  const reviewStatus = Object.values(ReconciliationReviewStatus).includes(requestedReview as ReconciliationReviewStatus) ? requestedReview as ReconciliationReviewStatus : undefined;
  const documentQuery = q.replace(/\D/g, "");
  const session = await auth();
  const [user, runs] = await Promise.all([
    session?.user?.email ? prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } }) : null,
    prisma.reconciliationRun.findMany({ where: { kind: ReconciliationKind.PEDIDOS }, orderBy: [{ competence: "desc" }, { importedAt: "desc" }], take: 60, select: { id: true, competence: true, fileName: true, importedAt: true, totalItems: true } }),
  ]);
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const selectedRunId = runs.some((run) => run.id === requestedRunId) ? requestedRunId : runs[0]?.id;
  const conditions: Prisma.ReconciliationItemWhereInput[] = [];
  if (q) conditions.push({ OR: [
    { externalOrderNumber: { contains: q, mode: "insensitive" } },
    { systemOrderNumber: { contains: q, mode: "insensitive" } },
    { systemClientName: { contains: q, mode: "insensitive" } },
    { externalVendorCode: { contains: q, mode: "insensitive" } },
    { systemPartnerRevCode: { contains: q, mode: "insensitive" } },
    ...(documentQuery ? [{ systemCpf: { contains: documentQuery } }, { systemCnpj: { contains: documentQuery } }] : []),
  ] });
  if (status) conditions.push({ status });
  if (reviewStatus) conditions.push({ reviewStatus });
  const [selectedRun, items, grouped] = selectedRunId ? await Promise.all([
    prisma.reconciliationRun.findUnique({ where: { id: selectedRunId } }),
    prisma.reconciliationItem.findMany({ where: { runId: selectedRunId, ...(conditions.length ? { AND: conditions } : {}) }, include: { reviewedBy: { select: { name: true } } }, orderBy: [{ status: "asc" }, { externalOrderNumber: "asc" }, { sourceLine: "asc" }], take: 1000 }),
    prisma.reconciliationItem.groupBy({ by: ["status"], where: { runId: selectedRunId }, _count: { _all: true } }),
  ]) : [null, [], []] as const;
  const totals = Object.fromEntries(grouped.map((item) => [item.status, item._count._all])) as Partial<Record<ReconciliationStatus, number>>;
  const activeFilters = Boolean(q || status || reviewStatus || requestedRunId);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold">Conciliação de pedidos</h2><p className="mt-1 text-slate-500">Compare a planilha mensal da Certisign com os pedidos já cadastrados no painel.</p></div>
      <div className="flex items-start gap-3">{selectedRun && <div className="rounded-xl border bg-white px-4 py-3 text-right text-sm"><p className="text-xs text-slate-500">Lote selecionado</p><b className="capitalize">{monthLabel(selectedRun.competence)}</b><p className="mt-1 max-w-64 truncate text-xs text-slate-500" title={selectedRun.fileName}>{selectedRun.fileName}</p></div>}<a href="/conciliacao/parceiros" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700">Comissões de parceiros</a></div>
    </div>

    {canManage && <ReconciliationImport initialCompetence={selectedRun ? `${selectedRun.competence.getUTCFullYear()}-${String(selectedRun.competence.getUTCMonth() + 1).padStart(2, "0")}` : undefined} />}

    {!selectedRun && <section className="rounded-xl border bg-white p-8 text-center text-slate-500"><b className="block text-slate-700">Nenhuma conciliação importada ainda.</b><p className="mt-2 text-sm">{canManage ? "Selecione a planilha mensal da Certisign acima para gerar a primeira conferência." : "Aguarde um administrador importar a primeira planilha mensal."}</p></section>}

    {selectedRun && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[["Conferidos", totals.CONFERIDO || 0, "text-emerald-700"], ["Com divergência", totals.DIVERGENTE || 0, "text-amber-700"], ["Somente no painel", totals.SOMENTE_PAINEL || 0, "text-sky-700"], ["Somente na Certisign", totals.SOMENTE_CERTISIGN || 0, "text-violet-700"], ["Revisão manual", totals.REVISAO_MANUAL || 0, "text-rose-700"]].map(([label, value, color]) => <div className="rounded-xl border bg-white p-4" key={String(label)}><p className="text-xs text-slate-500">{label}</p><b className={`mt-1 block text-2xl ${color}`}>{value}</b></div>)}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" action="/conciliacao">
          <select name="lote" defaultValue={selectedRunId} className="xl:col-span-2"><option value="">Lote mais recente</option>{runs.map((run) => <option key={run.id} value={run.id}>{monthLabel(run.competence)} · {run.fileName} · {run.importedAt.toLocaleDateString("pt-BR")}</option>)}</select>
          <input name="q" defaultValue={q} placeholder="Pedido, cliente, CPF, CNPJ ou Código REV" />
          <select name="status" defaultValue={status || ""}><option value="">Todos os resultados</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="revisao" defaultValue={reviewStatus || ""}><option value="">Toda revisão</option>{Object.entries(reviewLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <div className="flex gap-2 xl:col-span-2"><button className="brand-bg rounded-lg px-4 py-2 text-sm font-semibold text-white">Filtrar</button>{activeFilters && <a href="/conciliacao" className="rounded-lg border px-4 py-2 text-sm">Limpar</a>}</div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><b>Resultado por pedido</b><p className="mt-1 text-sm text-slate-500">{items.length} resultado(s) exibido(s). Valores e dados externos são apenas comparados, nunca substituídos.</p></div><span className="text-xs text-slate-500">Importado em {selectedRun.importedAt.toLocaleString("pt-BR")}</span></div>
        <TableScroll><table><thead><tr><th>Status</th><th>Pedido</th><th>Cliente / identificação</th><th>Parceiro / Código REV</th><th>Produto</th><th>Valor no painel</th><th>Valor Certisign</th><th>Detalhes</th><th>Revisão</th></tr></thead><tbody>{items.map((item) => {
          const systemProduct = [item.systemProductType, item.systemCertificateType, item.systemA3Model].filter(Boolean).join(" ");
          const externalProduct = [item.externalProductCode, item.externalProductName].filter(Boolean).join(" · ");
          return <tr key={item.id}><td><ReconciliationStatusBadge status={item.status} /></td><td className="font-medium">{item.externalOrderNumber || item.systemOrderNumber || "—"}{item.sourceLine && <span className="mt-1 block text-xs text-slate-500">Linha {item.sourceLine}</span>}</td><td>{item.systemClientName || item.externalClientName || "—"}{(item.systemCpf || item.systemCnpj) && <span className="mt-1 block text-xs text-slate-500">{item.systemCpf || item.systemCnpj}</span>}</td><td>{item.systemPartnerName || "—"}{item.systemPartnerRevCode && <span className="mt-1 block text-xs text-slate-500">REV {item.systemPartnerRevCode}</span>}{item.externalVendorCode && <span className="mt-1 block text-xs text-slate-400">Certisign: {item.externalVendorCode}</span>}</td><td><span>{systemProduct || "—"}</span>{externalProduct && <span className="mt-1 block max-w-64 truncate text-xs text-slate-500" title={externalProduct}>{externalProduct}</span>}</td><td>{money(item.systemValue)}</td><td>{money(item.externalBillingAmount)}</td><td className="max-w-80 whitespace-normal text-sm text-slate-600">{differenceText(item.differences)}</td><td>{canManage && item.status !== ReconciliationStatus.IGNORADO ? <ReconciliationActions item={{ id: item.id, reviewStatus: item.reviewStatus, reviewNote: item.reviewNote }} /> : <div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{reviewLabel[item.reviewStatus]}</span>{item.reviewNote && <span className="mt-1 block max-w-48 text-xs text-slate-500">{item.reviewNote}</span>}{item.reviewedBy?.name && <span className="mt-1 block text-xs text-slate-400">por {item.reviewedBy.name}</span>}</div>}</td></tr>;
        })}{items.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-slate-500">Nenhum pedido encontrado com estes filtros.</td></tr>}</tbody></table></TableScroll>
      </section>
    </>}
  </div>;
}
