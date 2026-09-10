import Link from "next/link";
import { Prisma, ReconciliationKind } from "@prisma/client";
import { auth } from "@/auth";
import { TableScroll } from "@/components/layout/table-scroll";
import { PartnerCommissionAction } from "@/components/reconciliation/partner-commission-action";
import { PartnerCommissionImport } from "@/components/reconciliation/partner-commission-import";
import { assessPartnerCommission, partnerCommissionStatusInfo, type PartnerReference } from "@/lib/partner-commission-reconciliation";
import { prisma } from "@/lib/prisma";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const asString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";
const money = (value: Prisma.Decimal | number | null) => value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = (value: Date) => value.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function PartnerCommissionReconciliationPage({ searchParams }: PageProps) {
  const requestedRunId = asString((await searchParams).lote);
  const session = await auth();
  const [user, runs, partners] = await Promise.all([
    session?.user?.email ? prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } }) : null,
    prisma.reconciliationRun.findMany({ where: { kind: ReconciliationKind.PARCEIROS }, orderBy: [{ competence: "desc" }, { importedAt: "desc" }], take: 60, select: { id: true, competence: true, fileName: true, importedAt: true, totalItems: true } }),
    prisma.partner.findMany({ orderBy: { officeName: "asc" }, select: { id: true, officeName: true, revCode: true } }),
  ]);
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const canApply = user?.role === "SUPER_ADMIN";
  const selectedRunId = runs.some((run) => run.id === requestedRunId) ? requestedRunId : runs[0]?.id;
  const [selectedRun, rawItems] = selectedRunId ? await Promise.all([
    prisma.reconciliationRun.findUnique({ where: { id: selectedRunId } }),
    prisma.reconciliationItem.findMany({
      where: { runId: selectedRunId, externalOrderNumber: { not: null } },
      include: { client: { include: { partner: { select: { id: true, officeName: true, revCode: true } } } }, commissionAppliedBy: { select: { name: true } }, commissionAppliedPartner: { select: { id: true, officeName: true, revCode: true } } },
      orderBy: [{ externalVendorCode: "asc" }, { externalOrderNumber: "asc" }],
      take: 1200,
    }),
  ]) : [null, []] as const;
  const codes = [...new Set(rawItems.flatMap((item) => item.externalVendorCode ? [item.externalVendorCode] : []))];
  const [mappings, close] = selectedRun ? await Promise.all([
    codes.length ? prisma.certisignPartnerMapping.findMany({ where: { externalVendorCode: { in: codes } }, include: { partner: { select: { id: true, officeName: true, revCode: true } } } }) : Promise.resolve([]),
    prisma.financialClose.findUnique({ where: { month: selectedRun.competence }, select: { id: true } }),
  ]) : [[], null] as const;
  const partnerByRevCode = new Map(partners.map((partner) => [partner.revCode, partner]));
  const mappingByCode = new Map(mappings.map((mapping) => [mapping.externalVendorCode, mapping]));
  const items = selectedRun ? rawItems.map((item) => {
    const mapping = item.externalVendorCode ? mappingByCode.get(item.externalVendorCode) : undefined;
    const suggestedPartner: PartnerReference | null = mapping?.partner || (item.externalVendorCode ? partnerByRevCode.get(item.externalVendorCode) || null : null);
    const assessment = assessPartnerCommission({
      externalCommission: item.externalCommissionAmount === null ? null : Number(item.externalCommissionAmount),
      externalVendorCode: item.externalVendorCode,
      client: item.client ? { id: item.client.id, purchaseDate: item.client.purchaseDate, estimatedValue: item.client.estimatedValue, partner: item.client.partner } : null,
      competence: selectedRun.competence,
      partnerByExternalCode: suggestedPartner,
      hasSavedMapping: Boolean(mapping),
      financialMonthClosed: Boolean(close),
      commissionAppliedAt: item.commissionAppliedAt,
    });
    return { item, assessment };
  }) : [];
  const totals = items.reduce<Record<string, number>>((result, { assessment }) => { result[assessment.status] = (result[assessment.status] || 0) + 1; return result; }, {});
  const sourceCommissionTotal = items.reduce((total, { item }) => total + Number(item.externalCommissionAmount || 0), 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/conciliacao" className="text-sm brand-text">← Conciliação de pedidos</Link><h2 className="mt-2 text-2xl font-bold">Comissões de parceiros</h2><p className="mt-1 max-w-3xl text-slate-500">Compare a planilha mensal da Certisign. A comissão só é incluída após confirmação do Proprietário, vinculando o parceiro ao pedido existente sem criar venda ou alterar preço.</p></div>{selectedRun && <div className="rounded-xl border bg-white px-4 py-3 text-right text-sm"><p className="text-xs text-slate-500">Lote selecionado</p><b className="capitalize">{monthLabel(selectedRun.competence)}</b><p className="mt-1 max-w-64 truncate text-xs text-slate-500" title={selectedRun.fileName}>{selectedRun.fileName}</p></div>}</div>
    {canManage && <PartnerCommissionImport initialCompetence={selectedRun ? `${selectedRun.competence.getUTCFullYear()}-${String(selectedRun.competence.getUTCMonth() + 1).padStart(2, "0")}` : undefined} />}
    {!selectedRun && <section className="rounded-xl border bg-white p-8 text-center text-slate-500"><b className="block text-slate-700">Nenhuma conciliação de parceiros importada ainda.</b><p className="mt-2 text-sm">{canManage ? "Selecione a planilha mensal de parceiros para gerar a primeira conferência." : "Aguarde um administrador importar uma planilha de parceiros."}</p></section>}
    {selectedRun && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Comissão na Certisign</p><b className="mt-1 block text-2xl text-slate-800">{money(sourceCommissionTotal)}</b></div>{Object.entries(totals).map(([status, count]) => <div className="rounded-xl border bg-white p-4" key={status}><p className="text-xs text-slate-500">{partnerCommissionStatusInfo[status as keyof typeof partnerCommissionStatusInfo]?.label || status}</p><b className="mt-1 block text-2xl">{count}</b></div>)}</section>
      <section className="rounded-xl border bg-white p-5"><form action="/conciliacao/parceiros" className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Lote<select name="lote" defaultValue={selectedRunId} className="mt-1 min-w-80"><option value="">Lote mais recente</option>{runs.map((run) => <option value={run.id} key={run.id}>{monthLabel(run.competence)} · {run.fileName} · {run.importedAt.toLocaleDateString("pt-BR")}</option>)}</select></label><button className="brand-bg rounded-lg px-4 py-2 text-sm font-semibold text-white">Abrir lote</button></form></section>
      <section className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><b>Resultado por pedido</b><p className="mt-1 max-w-3xl text-sm text-slate-500">Cod.Vendedor é um código da Certisign. Quando não coincidir com um Código REV já cadastrado, o Proprietário escolhe o parceiro uma vez; esse mapeamento fica salvo para as próximas planilhas. A planilha nunca cria um pedido novo.</p></div>{close && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Mês financeiro fechado</span>}</div><TableScroll><table><thead><tr><th>Status</th><th>Pedido / cliente</th><th>Vendedor Certisign</th><th>Parceiro no painel</th><th>Comissão Certisign</th><th>10% no painel</th><th>Detalhes</th><th>Ação</th></tr></thead><tbody>{items.map(({ item, assessment }) => { const visual = partnerCommissionStatusInfo[assessment.status]; const panelPartner = item.client?.partner || null; return <tr key={item.id}><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${visual.className}`}>{visual.label}</span></td><td><b>{item.externalOrderNumber}</b><span className="mt-1 block max-w-52 truncate text-xs text-slate-500" title={item.client?.name || item.client?.legalName || item.systemClientName || ""}>{item.client?.name || item.client?.legalName || item.systemClientName || "—"}</span></td><td>{item.externalVendorCode || "—"}<span className="mt-1 block max-w-56 truncate text-xs text-slate-500" title={item.externalVendorName || ""}>{item.externalVendorName || ""}</span></td><td>{panelPartner?.officeName || "Não vinculado"}<span className="mt-1 block text-xs text-slate-500">{panelPartner ? `REV ${panelPartner.revCode}` : ""}</span></td><td>{money(item.externalCommissionAmount)}</td><td>{money(assessment.expectedCommission)}</td><td className="max-w-80 whitespace-normal text-sm text-slate-600">{assessment.message}</td><td>{canApply ? <PartnerCommissionAction itemId={item.id} orderNumber={item.externalOrderNumber || ""} commission={Number(item.externalCommissionAmount || 0)} partners={partners} defaultPartnerId={assessment.suggestedPartner?.id} mappingKnown={assessment.hasSavedMapping} canApply={assessment.canApply} appliedAt={item.commissionAppliedAt} appliedByName={item.commissionAppliedBy?.name} /> : item.commissionAppliedAt ? <span className="text-xs text-emerald-700">Adicionada</span> : <span className="text-xs text-slate-400">Somente Proprietário</span>}</td></tr>; })}{!items.length && <tr><td colSpan={8} className="py-10 text-center text-slate-500">Nenhum pedido foi encontrado neste lote.</td></tr>}</tbody></table></TableScroll></section>
    </>}
  </div>;
}
