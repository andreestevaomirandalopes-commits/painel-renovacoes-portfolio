"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, XCircle } from "lucide-react";
import { TableScroll } from "@/components/layout/table-scroll";

type ReconciliationPreviewItem = {
  status: string;
  externalOrderNumber?: string | null;
  systemClientName?: string | null;
  systemValue?: number | string | null;
  externalBillingAmount?: number | string | null;
  differences?: { message?: string }[] | null;
};

type ReconciliationPreview = {
  fileName: string;
  sheetName?: string | null;
  totalSourceRows: number;
  validSourceRows: number;
  invalidSourceRows: number;
  ignoredSourceRows: number;
  alreadyImported?: boolean;
  summary?: Record<string, number> | null;
  items: ReconciliationPreviewItem[];
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error?: { message?: string } }
  | T;

const statusInfo: Record<string, { label: string; className: string }> = {
  CONFERIDO: { label: "Conferido", className: "bg-emerald-100 text-emerald-700" },
  DIVERGENTE: { label: "Com divergência", className: "bg-amber-100 text-amber-800" },
  SOMENTE_PAINEL: { label: "Somente no painel", className: "bg-sky-100 text-sky-700" },
  SOMENTE_CERTISIGN: { label: "Somente na Certisign", className: "bg-violet-100 text-violet-700" },
  REVISAO_MANUAL: { label: "Revisão manual", className: "bg-rose-100 text-rose-700" },
  IGNORADO: { label: "Linha ignorada", className: "bg-slate-100 text-slate-600" },
};

const summaryLabel: Record<string, string> = {
  CONFERIDO: "Conferidos",
  DIVERGENTE: "Com divergências",
  SOMENTE_PAINEL: "Somente no painel",
  SOMENTE_CERTISIGN: "Somente na Certisign",
  REVISAO_MANUAL: "Revisão manual",
  IGNORADO: "Linhas ignoradas",
};

const currentCompetence = () => new Date().toISOString().slice(0, 7);

const money = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

function readResult<T>(result: ApiResponse<T>): { data?: T; error?: string } {
  if (typeof result === "object" && result !== null && "success" in result) {
    if (result.success) return { data: result.data };
    return { error: result.error?.message || "Não foi possível concluir esta operação." };
  }
  return { data: result as T };
}

function getStatusInfo(status: string) {
  return statusInfo[status] || { label: status || "Não classificado", className: "bg-slate-100 text-slate-700" };
}

export type ReconciliationImportProps = {
  initialCompetence?: string;
  onImported?: (runId: string) => void;
};

/**
 * Upload em duas etapas: primeiro analisa a planilha; só depois o usuário confirma
 * a gravação do lote de conciliação. Nenhuma ação deste componente altera clientes
 * ou vendas diretamente.
 */
export function ReconciliationImport({ initialCompetence = currentCompetence(), onImported }: ReconciliationImportProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [competence, setCompetence] = useState(initialCompetence);
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const calculatedSummary = useMemo(() => {
    if (!preview) return [] as [string, number][];
    const fromApi = Object.entries(preview.summary || {}).filter(([, value]) => typeof value === "number");
    if (fromApi.length) return fromApi;
    return Object.entries(preview.items.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.status] = (accumulator[item.status] || 0) + 1;
      return accumulator;
    }, {}));
  }, [preview]);

  function buildFormData() {
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("competence", competence);
    return form;
  }

  async function analyze() {
    if (!file) {
      setError("Selecione a planilha mensal enviada pela Certisign.");
      return;
    }
    if (!competence) {
      setError("Informe a competência da planilha.");
      return;
    }

    setLoadingPreview(true);
    setPreview(null);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/reconciliations/preview", { method: "POST", body: buildFormData() });
      const result = readResult<ReconciliationPreview>(await response.json());
      if (!response.ok || !result.data) {
        setError(result.error || "Não foi possível analisar a planilha.");
        return;
      }
      setPreview(result.data);
      setMessage(result.data.alreadyImported
        ? "Esta mesma planilha já foi importada para esta competência. Abra o lote já registrado para consultá-lo."
        : "Prévia gerada. Confira os resultados antes de importar o lote.");
    } catch {
      setError("Não foi possível conectar ao painel para analisar a planilha.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function importReconciliation() {
    if (!file || !preview) return;
    if (!window.confirm("Confirmar a importação desta conciliação? Clientes, vendas e faturamento não serão alterados automaticamente.")) return;

    setLoadingImport(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/reconciliations", { method: "POST", body: buildFormData() });
      const result = readResult<{ runId: string }>(await response.json());
      if (!response.ok || !result.data?.runId) {
        setError(result.error || "Não foi possível importar a conciliação.");
        return;
      }
      setMessage("Conciliação importada com sucesso.");
      onImported?.(result.data.runId);
      router.push(`/conciliacao?lote=${result.data.runId}`);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao painel para importar a conciliação.");
    } finally {
      setLoadingImport(false);
    }
  }

  function clearSelection() {
    setFile(null);
    setPreview(null);
    setMessage("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <section className="overflow-hidden rounded-xl border bg-white">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
      <div>
        <h3 className="flex items-center gap-2 font-bold"><FileSpreadsheet size={19} className="brand-text" />Importar planilha de acerto</h3>
        <p className="mt-1 text-sm text-slate-500">Analise primeiro; a confirmação salvará apenas o resultado da conferência.</p>
      </div>
      <label className="text-sm font-medium text-slate-600">Competência
        <input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} disabled={loadingPreview || loadingImport} className="mt-1 w-auto" />
      </label>
    </div>

    <div className="space-y-4 p-5">
      <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-slate-400">
        <Upload size={18} />
        <span>{file ? file.name : "Selecionar planilha .xlsx ou .csv"}</span>
        <input ref={inputRef} className="sr-only" type="file" accept=".xlsx,.csv" disabled={loadingPreview || loadingImport} onChange={(event) => {
          const selected = event.target.files?.[0] || null;
          setFile(selected);
          setPreview(null);
          setMessage("");
          setError("");
        }} />
      </label>
      <p className="text-xs text-slate-500">Dados preservados: pedido, códigos Certisign, produto, datas e valores. CPF/CNPJ serão mostrados quando houver pedido correspondente no painel.</p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={analyze} disabled={!file || loadingPreview || loadingImport} className="brand-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loadingPreview && <LoaderCircle size={16} className="animate-spin" />}{loadingPreview ? "Analisando..." : "Analisar planilha"}
        </button>
        {(file || preview) && <button type="button" onClick={clearSelection} disabled={loadingPreview || loadingImport} className="border rounded-lg px-4 py-2 text-sm">Trocar arquivo</button>}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      {message && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>}
    </div>

    {preview && <div className="border-t p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="font-bold">Prévia de {preview.fileName}</h4>
          <p className="mt-1 text-sm text-slate-500">{preview.sheetName ? `Aba: ${preview.sheetName} · ` : ""}{preview.totalSourceRows} linha(s) lida(s).</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">{preview.validSourceRows} válida(s)</span>
          <span className="rounded-full bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">{preview.invalidSourceRows} inválida(s)</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">{preview.ignoredSourceRows} ignorada(s)</span>
        </div>
      </div>

      {calculatedSummary.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {calculatedSummary.map(([status, count]) => {
          const info = getStatusInfo(status);
          return <div className="rounded-xl border bg-white p-4" key={status}>
            <p className="text-xs text-slate-500">{summaryLabel[status] || info.label}</p>
            <b className="mt-1 block text-2xl">{count}</b>
          </div>;
        })}
      </div>}

      <div className="overflow-hidden rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div><b className="text-sm">Resultado da comparação</b><p className="mt-1 text-xs text-slate-500">A prévia mostra até 80 registros. Divergências não alteram nenhum dado automaticamente.</p></div>
          <span className="text-xs text-slate-500">{preview.items.length} resultado(s)</span>
        </div>
        <TableScroll><table><thead><tr><th>Status</th><th>Pedido</th><th>Cliente no painel</th><th>Valor no painel</th><th>Valor Certisign</th><th>Detalhes</th></tr></thead><tbody>{preview.items.slice(0, 80).map((item, index) => {
          const info = getStatusInfo(item.status);
          const details = item.differences?.map((difference) => difference.message).filter(Boolean).join(" · ");
          return <tr key={`${item.externalOrderNumber || "sem-pedido"}-${index}`}><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${info.className}`}>{info.label}</span></td><td className="font-medium">{item.externalOrderNumber || "—"}</td><td>{item.systemClientName || "—"}</td><td>{money(item.systemValue)}</td><td>{money(item.externalBillingAmount)}</td><td className="max-w-80 whitespace-normal text-sm text-slate-600">{details || (item.status === "CONFERIDO" ? "Dados compatíveis" : "Sem detalhes adicionais")}</td></tr>;
        })}{preview.items.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Nenhum pedido foi encontrado para comparar.</td></tr>}</tbody></table></TableScroll>
      </div>
      {preview.items.length > 80 && <p className="text-xs text-slate-500">A tabela mostra os primeiros 80 resultados; todos serão registrados quando a importação for confirmada.</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
        <p className="max-w-2xl text-sm text-slate-600"><CheckCircle2 size={16} className="mr-1 inline brand-text" />Ao confirmar, o painel guardará o lote e seus status para consulta. Ele não corrigirá pedidos nem valores por conta própria.</p>
        <button type="button" onClick={importReconciliation} disabled={loadingImport || loadingPreview || preview.alreadyImported} className="brand-bg inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loadingImport && <LoaderCircle size={16} className="animate-spin" />}{preview.alreadyImported ? "Planilha já importada" : loadingImport ? "Importando..." : "Confirmar e salvar conciliação"}
        </button>
      </div>
    </div>}
  </section>;
}

export function ReconciliationStatusBadge({ status }: { status: string }) {
  const info = getStatusInfo(status);
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${info.className}`}>{status === "REVISAO_MANUAL" && <XCircle size={13} className="mr-1" />}{info.label}</span>;
}
