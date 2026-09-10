import { CnpjAlertStatus, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TableScroll } from "@/components/layout/table-scroll";
import { CnpjAlertImport } from "@/components/cnpj-alerts/alert-import";
import { CnpjAlertActions, CnpjAlertReadOnly } from "@/components/cnpj-alerts/alert-actions";

const statusLabel: Record<CnpjAlertStatus, string> = { NOVO: "Novo", EM_ANALISE: "Em análise", APROVADO_CONTATO: "Aprovado", CONTATADO: "Contatado", DESCARTADO: "Descartado" };
const statusClass: Record<CnpjAlertStatus, string> = { NOVO: "bg-sky-100 text-sky-700", EM_ANALISE: "bg-amber-100 text-amber-800", APROVADO_CONTATO: "bg-violet-100 text-violet-700", CONTATADO: "bg-emerald-100 text-emerald-700", DESCARTADO: "bg-slate-100 text-slate-600" };
const formatCnpj = (value: string) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const activityLabel: Record<string, string> = { ALERT_CREATED: "Adicionado", ALERT_UPDATED_BY_IMPORT: "Dados atualizados", ALERT_STATUS_UPDATED: "Status alterado", EMAIL_SENT: "E-mail enviado", EMAIL_FAILED: "Falha no e-mail" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const asString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

export default async function CnpjAlertsPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const q = asString(filters.q).trim();
  const status = asString(filters.status);
  const city = asString(filters.city).trim();
  const state = asString(filters.state).trim().toUpperCase();
  const cnae = asString(filters.cnae).trim();
  const contact = asString(filters.contact);
  const onlyNew = asString(filters.onlyNew) === "1";
  const dateFrom = asString(filters.dateFrom);
  const dateTo = asString(filters.dateTo);

  const conditions: Prisma.CnpjAlertWhereInput[] = [];
  if (q) conditions.push({ OR: [{ cnpj: { contains: q.replace(/\D/g, "") } }, { legalName: { contains: q, mode: "insensitive" } }, { tradeName: { contains: q, mode: "insensitive" } }] });
  if (status && Object.values(CnpjAlertStatus).includes(status as CnpjAlertStatus)) conditions.push({ status: status as CnpjAlertStatus });
  if (city) conditions.push({ city: { contains: city, mode: "insensitive" } });
  if (state) conditions.push({ state });
  if (cnae) conditions.push({ cnae: { contains: cnae, mode: "insensitive" } });
  if (onlyNew) conditions.push({ status: "NOVO" });
  if (contact === "email") conditions.push({ email: { not: null } });
  if (contact === "withoutEmail") conditions.push({ email: null });
  if (contact === "phone") conditions.push({ phone: { not: null } });
  if (contact === "withoutPhone") conditions.push({ phone: null });
  if (dateFrom || dateTo) conditions.push({ openingDate: { ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}), ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}) } });
  const where: Prisma.CnpjAlertWhereInput = conditions.length ? { AND: conditions } : {};

  const session = await auth();
  const [user, alerts, counts] = await Promise.all([
    session?.user?.email ? prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } }) : null,
    prisma.cnpjAlert.findMany({ where, orderBy: [{ receivedAt: "desc" }], take: 500, include: { activities: { orderBy: { createdAt: "desc" }, take: 1, include: { actorUser: { select: { name: true, email: true } } } } } }),
    prisma.cnpjAlert.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const totalByStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all])) as Partial<Record<CnpjAlertStatus, number>>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Alertas de novos CNPJs</h2><p className="mt-1 text-slate-500">Analise empresas recém-abertas antes de autorizar qualquer contato comercial.</p></div><div className="flex gap-2">{(["NOVO", "EM_ANALISE", "APROVADO_CONTATO", "CONTATADO"] as CnpjAlertStatus[]).map((item) => <div key={item} className="rounded-xl border bg-white px-3 py-2 text-center"><p className="text-xs text-slate-500">{statusLabel[item]}</p><b>{totalByStatus[item] || 0}</b></div>)}</div></div>

    {canManage && <CnpjAlertImport />}

    <section className="rounded-xl border bg-white p-5">
      <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" action="/alertas-cnpj">
        <input name="q" defaultValue={q} placeholder="CNPJ, razão social ou fantasia" className="xl:col-span-2" />
        <select name="status" defaultValue={status}><option value="">Todos os status</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input name="city" defaultValue={city} placeholder="Cidade" />
        <input name="state" defaultValue={state} maxLength={2} placeholder="UF" />
        <input name="cnae" defaultValue={cnae} placeholder="CNAE" />
        <select name="contact" defaultValue={contact}><option value="">E-mail e telefone</option><option value="email">Com e-mail</option><option value="withoutEmail">Sem e-mail</option><option value="phone">Com telefone</option><option value="withoutPhone">Sem telefone</option></select>
        <label className="text-xs font-medium text-slate-600">Abertura a partir de<input type="date" name="dateFrom" defaultValue={dateFrom} /></label>
        <label className="text-xs font-medium text-slate-600">Abertura até<input type="date" name="dateTo" defaultValue={dateTo} /></label>
        <label className="flex items-center gap-2 self-end rounded-lg border px-3 py-2 text-sm"><input type="checkbox" name="onlyNew" value="1" defaultChecked={onlyNew} className="h-4 w-4" />Somente novos</label>
        <div className="flex gap-2 self-end"><button className="brand-bg rounded-lg px-4 py-2 text-sm font-semibold text-white">Filtrar</button><a href="/alertas-cnpj" className="border rounded-lg px-4 py-2 text-sm">Limpar</a></div>
      </form>
    </section>

    <section className="overflow-hidden rounded-xl border bg-white"><div className="flex items-center justify-between border-b p-5"><div><b>Empresas identificadas</b><p className="mt-1 text-sm text-slate-500">{alerts.length} resultado(s). CNPJs importados novamente são atualizados sem duplicar o alerta.</p></div></div><TableScroll><table><thead><tr><th>CNPJ</th><th>Empresa</th><th>Abertura</th><th>Localização</th><th>CNAE</th><th>Contato</th><th>Fonte / recebido</th><th>Status</th><th>Última ação</th><th>{canManage ? "Ações" : "Acesso"}</th></tr></thead><tbody>{alerts.map((alert) => { const activity = alert.activities[0]; return <tr key={alert.id}><td className="font-medium">{formatCnpj(alert.cnpj)}</td><td><b>{alert.legalName}</b>{alert.tradeName && <><br /><span className="text-xs text-slate-500">{alert.tradeName}</span></>}</td><td>{alert.openingDate ? alert.openingDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}</td><td>{alert.city}<br /><span className="text-xs text-slate-500">{alert.state}</span></td><td className="max-w-48 truncate" title={alert.cnae || undefined}>{alert.cnae || "—"}</td><td>{alert.email || "—"}{alert.phone && <><br /><span className="text-xs text-slate-500">{alert.phone}</span></>}</td><td>{alert.source}<br /><span className="text-xs text-slate-500">{alert.receivedAt.toLocaleDateString("pt-BR")}</span></td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[alert.status]}`}>{statusLabel[alert.status]}</span>{alert.doNotContact && <p className="mt-1 text-xs text-rose-700">Não contatar</p>}</td><td>{activity ? <><span className="text-sm">{activityLabel[activity.action] || activity.action}</span><br /><span className="text-xs text-slate-500">{activity.actorUser?.name || "Sistema"} · {activity.createdAt.toLocaleDateString("pt-BR")}</span></> : "—"}</td><td>{canManage ? <CnpjAlertActions alert={{ id: alert.id, status: alert.status, email: alert.email, doNotContact: alert.doNotContact }} /> : <CnpjAlertReadOnly status={alert.status} doNotContact={alert.doNotContact} email={alert.email} />}</td></tr> })}{alerts.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-slate-500">Nenhum alerta encontrado. Importe uma planilha para começar o teste.</td></tr>}</tbody></table></TableScroll></section>
  </div>;
}
