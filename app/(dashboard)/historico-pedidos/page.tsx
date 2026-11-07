import Link from "next/link";
import { auth } from "@/auth";
import { ClientManagementActions } from "@/components/clients/client-management-actions";
import { TableScroll } from "@/components/layout/table-scroll";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;

function asPage(value: string | undefined) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDateTime(value: Date) {
  return {
    date: value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    time: value.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
  };
}

function orderTypeLabel(orderType: "RENOVADO" | "VENDA_NOVA") {
  return orderType === "RENOVADO" ? "Renovado" : "Venda Nova";
}

export default async function OrderHistory({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = asPage((await searchParams).page);
  const session = await auth();
  const user = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true } })
    : null;
  const canManageOrders = user?.role === "SUPER_ADMIN";
  const total = await prisma.client.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const orders = await prisma.client.findMany({
    select: { id: true, name: true, legalName: true, orderNumber: true, orderType: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return <>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Histórico de Pedidos</h2><p className="mt-1 text-slate-500">Pedidos ordenados pelo momento em que foram inseridos no painel.</p></div><span className="text-sm text-slate-500">{total} pedido(s) registrado(s)</span></div>
    <div className="overflow-hidden rounded-xl border bg-white"><TableScroll><table><thead><tr><th>Cliente</th><th>Número do pedido</th><th>Tipo do pedido</th><th>Data de inserção</th><th>Hora de inserção</th><th>Ações</th></tr></thead><tbody>{orders.map(order => { const insertedAt = formatDateTime(order.createdAt); return <tr key={order.id}><td>{order.name || order.legalName || "—"}</td><td className="font-medium">{order.orderNumber}</td><td>{orderTypeLabel(order.orderType)}</td><td>{insertedAt.date}</td><td>{insertedAt.time}</td><td>{canManageOrders && <ClientManagementActions clientId={order.id} context="pedido" showLabels/>}</td></tr>; })}{orders.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-slate-500">Nenhum pedido inserido ainda.</td></tr>}</tbody></table></TableScroll></div>
    {totalPages > 1 && <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginação do histórico de pedidos"><span className="text-sm text-slate-500">Página {currentPage} de {totalPages}</span><div className="flex gap-2">{currentPage > 1 && <Link href={`/historico-pedidos?page=${currentPage - 1}`} className="rounded-lg border px-3 py-2 text-sm">Anterior</Link>}{currentPage < totalPages && <Link href={`/historico-pedidos?page=${currentPage + 1}`} className="rounded-lg border px-3 py-2 text-sm">Próxima</Link>}</div></nav>}
  </>;
}
