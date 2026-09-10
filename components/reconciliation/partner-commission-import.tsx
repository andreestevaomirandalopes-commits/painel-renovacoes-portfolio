"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { TableScroll } from "@/components/layout/table-scroll";

type PreviewItem = {
  externalOrderNumber?: string | null;
  externalVendorCode?: string | null;
  externalVendorName?: string | null;
  externalCommissionAmount?: number | string | null;
  systemClientName?: string | null;
  expectedCommission?: number | string | null;
  status: string;
  message?: string;
};
type Preview = {
  fileName: string;
  sheetName?: string | null;
  totalSourceRows: number;
  validSourceRows: number;
  invalidSourceRows: number;
  ignoredSourceRows: number;
  totalItems: number;
  remuneratedItems: number;
  externalCommissionTotal: number;
  alreadyImported?: boolean;
  summary?: Record<string, number>;
  items: PreviewItem[];
};
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

const statusInfo: Record<string, { label: string; className: string }> = {
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
};

const money = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
};
const currentCompetence = () => new Date().toISOString().slice(0, 7);
const info = (status: string) => statusInfo[status] || { label: status || "Em análise", className: "bg-slate-100 text-slate-700" };

export function PartnerCommissionImport({ initialCompetence = currentCompetence() }: { initialCompetence?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [competence, setCompetence] = useState(initialCompetence);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const summary = useMemo(() => Object.entries(preview?.summary || {}), [preview]);
  const formData = () => {
    const data = new FormData();
    if (file) data.append("file", file);
    data.append("competence", competence);
    return data;
  };
  const readResponse = async <T,>(response: Response) => {
    const result = await response.json() as ApiResponse<T>;
    return result.success ? { data: result.data } : { error: result.error?.message || "Não foi possível concluir esta operação." };
  };

  async function analyze() {
    if (!file) return setError("Selecione a planilha de parceiros enviada pela Certisign.");
    if (!competence) return setError("Informe a competência da planilha.");
    setLoadingPreview(true); setPreview(null); setError(""); setMessage("");
    try {
      const response = await fetch("/api/reconciliations/partner-commissions/preview", { method: "POST", body: formData() });
      const result = await readResponse<Preview>(response);
      if (!response.ok || !result.data) return setError(result.error || "Não foi possível analisar a planilha.");
      setPreview(result.data);
      setMessage(result.data.alreadyImported ? "Esta mesma planilha já foi importada para a competência selecionada." : "Prévia pronta. Confira os vínculos antes de salvar a conciliação.");
    } catch { setError("Não foi possível conectar ao painel para analisar a planilha."); }
    finally { setLoadingPreview(false); }
  }

  async function save() {
    if (!file || !preview) return;
    if (!window.confirm("Salvar esta conciliação de parceiros? Nenhum pedido, valor de venda ou comissão será alterado agora.")) return;
    setLoadingImport(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/reconciliations/partner-commissions", { method: "POST", body: formData() });
      const result = await readResponse<{ runId: string }>(response);
      if (!response.ok || !result.data?.runId) return setError(result.error || "Não foi possível salvar a conciliação.");
      router.push(`/conciliacao/parceiros?lote=${result.data.runId}`);
      router.refresh();
    } catch { setError("Não foi possível conectar ao painel para salvar a conciliação."); }
    finally { setLoadingImport(false); }
  }

  function clear() { setFile(null); setPreview(null); setMessage(""); setError(""); if (inputRef.current) inputRef.current.value = ""; }

  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5"><div><h3 className="flex items-center gap-2 font-bold"><FileSpreadsheet size={19} className="brand-text" />Importar planilha de parceiros</h3><p className="mt-1 text-sm text-slate-500">Use a planilha mensal com Pedido, Código de vendedor e Valor total de comissão.</p></div><label className="text-sm font-medium text-slate-600">Competência<input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} disabled={loadingPreview || loadingImport} className="mt-1 w-auto" /></label></div>
    <div className="space-y-4 p-5">
      <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-slate-400"><Upload size={18} /><span>{file ? file.name : "Selecionar planilha .xlsx ou .csv"}</span><input ref={inputRef} type="file" accept=".xlsx,.csv" className="sr-only" disabled={loadingPreview || loadingImport} onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); setMessage(""); }} /></label>
      <p className="text-xs text-slate-500">O painel lê apenas as linhas de pedidos e nunca importa chaves PIX presentes no resumo da planilha.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={analyze} disabled={!file || loadingPreview || loadingImport} className="brand-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loadingPreview && <LoaderCircle size={16} className="animate-spin" />}{loadingPreview ? "Analisando..." : "Analisar planilha"}</button>{(file || preview) && <button type="button" onClick={clear} disabled={loadingPreview || loadingImport} className="rounded-lg border px-4 py-2 text-sm">Trocar arquivo</button>}</div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}{message && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>}
    </div>
    {preview && <div className="space-y-5 border-t p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h4 className="font-bold">Prévia de {preview.fileName}</h4><p className="mt-1 text-sm text-slate-500">{preview.sheetName ? `Aba: ${preview.sheetName} · ` : ""}{preview.totalItems} pedido(s) analisado(s); {preview.ignoredSourceRows} linha(s) de resumo ignorada(s).</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">{preview.remuneratedItems} com comissão</span><span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">Total Certisign: {money(preview.externalCommissionTotal)}</span></div></div>
      {summary.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map(([status, count]) => <div className="rounded-xl border p-4" key={status}><p className="text-xs text-slate-500">{info(status).label}</p><b className="mt-1 block text-2xl">{count}</b></div>)}</div>}
      <div className="overflow-hidden rounded-xl border"><div className="border-b p-4"><b className="text-sm">Resultado da comparação</b><p className="mt-1 text-xs text-slate-500">A confirmação apenas guarda o lote. A inclusão da comissão será sempre individual e confirmada pelo Proprietário.</p></div><TableScroll><table><thead><tr><th>Status</th><th>Pedido</th><th>Vendedor Certisign</th><th>Cliente no painel</th><th>Comissão Certisign</th><th>10% no painel</th><th>Detalhes</th></tr></thead><tbody>{preview.items.slice(0, 80).map((item, index) => { const state = info(item.status); return <tr key={`${item.externalOrderNumber || "sem-pedido"}-${index}`}><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${state.className}`}>{state.label}</span></td><td>{item.externalOrderNumber || "—"}</td><td>{item.externalVendorCode || "—"}<span className="mt-1 block max-w-56 truncate text-xs text-slate-500" title={item.externalVendorName || ""}>{item.externalVendorName || ""}</span></td><td>{item.systemClientName || "—"}</td><td>{money(item.externalCommissionAmount)}</td><td>{money(item.expectedCommission)}</td><td className="max-w-80 whitespace-normal text-sm text-slate-600">{item.message || "—"}</td></tr>; })}{!preview.items.length && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Nenhum pedido foi encontrado para conciliar.</td></tr>}</tbody></table></TableScroll></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><p className="max-w-2xl text-sm text-slate-600"><CheckCircle2 size={16} className="mr-1 inline brand-text" />Ao salvar, o painel cria somente o relatório da conferência. Nenhuma venda, preço, comissão ou parceiro é alterado nesta etapa.</p><button type="button" onClick={save} disabled={loadingImport || loadingPreview || preview.alreadyImported} className="brand-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loadingImport && <LoaderCircle size={16} className="animate-spin" />}{preview.alreadyImported ? "Planilha já importada" : loadingImport ? "Salvando..." : "Confirmar e salvar conciliação"}</button></div>
    </div>}
  </section>;
}
