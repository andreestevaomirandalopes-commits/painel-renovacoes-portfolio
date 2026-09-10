"use client";

import { useState } from "react";
import { CalendarDays, FileSpreadsheet, Upload } from "lucide-react";

type PreviewRow = {
  sourceLine: number;
  sourceOrderNumber: string;
  matchedOrderNumber: string | null;
  sourceIssuedAt: string | null;
  previousIssuedAt: string | null;
  previousExpirationDate: string | null;
  calculatedExpirationDate: string | null;
  status: string;
  message: string;
};

const labels: Record<string, string> = {
  ATUALIZAR: "Pronto para atualizar",
  SEM_ALTERACAO: "Já está atualizado",
  PEDIDO_NAO_ENCONTRADO: "Pedido não encontrado",
  PEDIDO_AMBIGUO: "Pedido ambíguo",
  PEDIDO_REPETIDO: "Pedido repetido na planilha",
  DATA_INVALIDA: "Data inválida",
  PEDIDO_RENOVADO: "Pedido já renovado",
  VENCIMENTO_DIVERGENTE: "Vencimento divergente",
  CONFLITO: "Conflito de alteração",
  ATUALIZADO: "Atualizado",
};

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value)) : "—";
const rowTone = (status: string) => status === "ATUALIZAR" ? "text-emerald-700" : status === "SEM_ALTERACAO" ? "text-slate-600" : "text-amber-700";

export function EmissionDateImport() {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const updateCount = rows.filter((row) => row.status === "ATUALIZAR").length;

  async function preview(file: File) {
    setLoading(true);
    setRows([]);
    setRunId("");
    setMessage("");
    setFailed(false);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/imports/emission-dates/preview", { method: "POST", body: form });
    const result = await response.json();
    setLoading(false);
    if (!result.success) { setFailed(true); return setMessage(result.error?.message || "Não foi possível ler a planilha."); }
    setRows(result.data.rows);
    setRunId(result.data.runId);
    setMessage(`${result.data.updateCount} pedido(s) pronto(s) para atualização, ${result.data.unchangedCount} sem alteração e ${result.data.pendingCount} para revisão.`);
  }

  async function apply() {
    if (!runId || !updateCount) return;
    if (!window.confirm(`Confirmar a atualização de ${updateCount} pedido(s)? Somente data de emissão, vencimento e status serão alterados.`)) return;
    setLoading(true);
    const response = await fetch("/api/imports/emission-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    const result = await response.json();
    setLoading(false);
    if (!result.success) { setFailed(true); return setMessage(result.error?.message || "Não foi possível confirmar a atualização."); }
    setFailed(false);
    setMessage(`Atualização concluída: ${result.data.applied} pedido(s) alterado(s) e ${result.data.skipped} preservado(s) para revisão.`);
    setRunId("");
    setRows([]);
    window.setTimeout(() => window.location.reload(), 1000);
  }

  return <section className="mt-6 bg-white border rounded-xl overflow-hidden">
    <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50">
      <span><span className="flex items-center gap-2 font-bold"><CalendarDays size={19} className="brand-text" />Atualizar datas de emissão</span><span className="block mt-1 text-sm font-normal text-slate-500">Use a planilha trimestral para corrigir a emissão e o vencimento real de pedidos já cadastrados.</span></span>
      <span className="text-sm brand-text font-semibold">{open ? "Fechar" : "Importar planilha trimestral"}</span>
    </button>
    {open && <div className="border-t p-5 space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-slate-700">
        <b className="text-slate-900">Proteção financeira:</b> esta importação não cria pedidos e não altera data de compra, valor, parceiro, comissão ou faturamento.<br />
        <b className="text-slate-900">Obrigatórias:</b> Número do pedido e Data de emissão. O vencimento será recalculado em 12 meses para A1 e 30 meses para A3.<br />
        Pedidos já renovados, repetidos ou divergentes ficam bloqueados para revisão. <b>Acesso exclusivo do Proprietário.</b>
        <a href="/modelos/modelo-datas-emissao.csv" download className="mt-2 inline-block brand-text font-semibold underline">Baixar modelo de planilha</a>
      </div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-slate-400">
        <Upload size={18} /> {loading ? "Lendo planilha..." : "Selecionar planilha .xlsx ou .csv"}
        <input className="sr-only" type="file" accept=".xlsx,.csv" disabled={loading} onChange={(event) => event.target.files?.[0] && preview(event.target.files[0])} />
      </label>
      {message && <p className={`text-sm font-medium ${failed ? "text-red-700" : "text-slate-700"}`}>{message}</p>}
      {rows.length > 0 && <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border"><table><thead><tr><th>Linha</th><th>Pedido planilha</th><th>Pedido no painel</th><th>Emissão atual</th><th>Nova emissão</th><th>Vencimento atual</th><th>Novo vencimento</th><th>Resultado</th></tr></thead><tbody>{rows.slice(0, 50).map((row) => <tr key={row.sourceLine} className={row.status === "ATUALIZAR" ? "bg-emerald-50/40" : ""}><td>{row.sourceLine}</td><td>{row.sourceOrderNumber}</td><td>{row.matchedOrderNumber || "—"}</td><td>{formatDate(row.previousIssuedAt)}</td><td>{formatDate(row.sourceIssuedAt)}</td><td>{formatDate(row.previousExpirationDate)}</td><td>{formatDate(row.calculatedExpirationDate)}</td><td className={rowTone(row.status)}><b>{labels[row.status] || row.status}</b><span className="block mt-1 text-xs font-normal text-slate-500">{row.message}</span></td></tr>)}</tbody></table></div>
        {rows.length > 50 && <p className="text-xs text-slate-500">Prévia limitada às primeiras 50 linhas. Todas as linhas foram validadas e registradas com segurança.</p>}
        <button type="button" onClick={apply} disabled={loading || !runId || !updateCount} className="brand-bg rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><FileSpreadsheet size={16} className="inline mr-2" />{loading ? "Atualizando..." : `Confirmar atualização de ${updateCount} pedido(s)`}</button>
      </div>}
    </div>}
  </section>;
}
