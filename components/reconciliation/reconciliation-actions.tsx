"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Save, XCircle } from "lucide-react";

type ReviewStatus = "PENDENTE" | "REVISADO" | "IGNORADO";

const reviewInfo: Record<ReviewStatus, { label: string; className: string }> = {
  PENDENTE: { label: "Pendente", className: "bg-amber-100 text-amber-800" },
  REVISADO: { label: "Revisado", className: "bg-emerald-100 text-emerald-700" },
  IGNORADO: { label: "Ignorado", className: "bg-slate-100 text-slate-600" },
};

type Props = {
  item: {
    id: string;
    reviewStatus?: ReviewStatus | null;
    reviewNote?: string | null;
  };
  readOnly?: boolean;
  onSaved?: () => void;
};

type ApiResult = { success?: boolean; error?: { message?: string } };

/** Ação manual da conciliação. Ela registra a revisão do usuário, sem alterar dados de venda. */
export function ReconciliationActions({ item, readOnly = false, onSaved }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ReviewStatus>(item.reviewStatus || "PENDENTE");
  const [note, setNote] = useState(item.reviewNote || "");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (status === "IGNORADO" && !window.confirm("Ignorar esta divergência? O pedido continuará registrado no histórico de conciliação.")) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/reconciliations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status, reviewNote: note.trim() || undefined }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || result.success === false) {
        setMessage(result.error?.message || "Não foi possível registrar a revisão.");
        return;
      }
      setMessage("Revisão registrada.");
      onSaved?.();
      router.refresh();
    } catch {
      setMessage("Não foi possível conectar ao painel para registrar a revisão.");
    } finally {
      setLoading(false);
    }
  }

  const info = reviewInfo[status];
  if (readOnly) return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${info.className}`}>{info.label}</span>;

  return <div className="min-w-52 space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${info.className}`}>{info.label}</span>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="border rounded-md px-2 py-1 text-xs" disabled={loading}>{expanded ? "Fechar" : "Revisar"}</button>
    </div>
    {expanded && <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
      <label className="block text-xs font-medium text-slate-600">Situação da revisão
        <select value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus)} disabled={loading} className="mt-1 text-sm">
          <option value="PENDENTE">Pendente</option>
          <option value="REVISADO">Revisado</option>
          <option value="IGNORADO">Ignorar divergência</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">Observação (opcional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={loading} rows={3} maxLength={500} placeholder="Ex.: conferido com a Certisign em 31/08" className="mt-1 resize-y text-sm" />
      </label>
      <button type="button" onClick={save} disabled={loading} className="brand-bg inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : status === "REVISADO" ? <Check size={14} /> : status === "IGNORADO" ? <XCircle size={14} /> : <Save size={14} />}
        {loading ? "Salvando..." : "Salvar revisão"}
      </button>
    </div>}
    {message && <p className={`text-xs ${message === "Revisão registrada." ? "text-emerald-700" : "text-rose-700"}`}>{message}</p>}
  </div>;
}
