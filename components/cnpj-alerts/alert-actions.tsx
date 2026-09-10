"use client";

import { useState } from "react";
import { Eye, Send, ShieldBan } from "lucide-react";

type AlertActionsProps = {
  alert: { id: string; status: "NOVO" | "EM_ANALISE" | "APROVADO_CONTATO" | "CONTATADO" | "DESCARTADO"; email: string | null; doNotContact: boolean };
};

const statusText = { NOVO: "Novo", EM_ANALISE: "Em análise", APROVADO_CONTATO: "Aprovado para contato", CONTATADO: "Contatado", DESCARTADO: "Descartado" };

export function CnpjAlertActions({ alert }: AlertActionsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ subject: string; message: string; recipient: string | null; canSend: boolean } | null>(null);

  async function update(payload: Record<string, unknown>) {
    setLoading(true); setMessage("");
    const response = await fetch(`/api/cnpj-alerts/${alert.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    setLoading(false);
    if (!result.success) return setMessage(result.error.message);
    window.location.reload();
  }

  async function getPreview() {
    setLoading(true); setMessage("");
    const response = await fetch(`/api/cnpj-alerts/${alert.id}/email`);
    const result = await response.json();
    setLoading(false);
    if (!result.success) return setMessage(result.error.message);
    setPreview(result.data);
  }

  async function send() {
    if (!window.confirm("Enviar este e-mail agora?")) return;
    setLoading(true); setMessage("");
    const response = await fetch(`/api/cnpj-alerts/${alert.id}/email`, { method: "POST" });
    const result = await response.json();
    setLoading(false);
    if (!result.success) return setMessage(result.error.message);
    setMessage(result.data.message);
    window.setTimeout(() => window.location.reload(), 600);
  }

  return <div className="min-w-52 space-y-2">
    <div className="flex flex-wrap gap-1.5">
      {alert.status === "NOVO" && <button title="Iniciar análise" disabled={loading} onClick={() => update({ status: "EM_ANALISE" })} className="border rounded-md px-2 py-1 text-xs">Analisar</button>}
      {(alert.status === "NOVO" || alert.status === "EM_ANALISE" || alert.status === "DESCARTADO") && !alert.doNotContact && <button title="Aprovar para contato" disabled={loading} onClick={() => update({ status: "APROVADO_CONTATO" })} className="border rounded-md px-2 py-1 text-xs text-emerald-700">Aprovar</button>}
      {alert.status !== "DESCARTADO" && !alert.doNotContact && <button title="Descartar alerta" disabled={loading} onClick={() => update({ status: "DESCARTADO" })} className="border rounded-md px-2 py-1 text-xs text-slate-600">Descartar</button>}
      {!alert.doNotContact && <button title="Não receber novos contatos" disabled={loading} onClick={() => window.confirm("Bloquear novos contatos para esta empresa?") && update({ doNotContact: true })} className="border rounded-md p-1 text-rose-700"><ShieldBan size={14} /></button>}
      {alert.status === "APROVADO_CONTATO" && !alert.doNotContact && <button title="Ver prévia do e-mail" disabled={loading} onClick={getPreview} className="border rounded-md p-1 brand-text"><Eye size={14} /></button>}
    </div>
    {alert.doNotContact && <p className="text-xs text-rose-700">Contato bloqueado</p>}
    {preview && <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap"><p className="mb-2"><b>Para:</b> {preview.recipient || "Sem e-mail"}</p><p className="mb-2"><b>Assunto:</b> {preview.subject}</p><p className="border-t pt-2">{preview.message}</p><button type="button" disabled={!preview.canSend || loading} onClick={send} className="mt-3 inline-flex items-center gap-1 rounded-md brand-bg px-2 py-1.5 font-semibold text-white disabled:opacity-50"><Send size={13} />Enviar e-mail</button></div>}
    {message && <p className="text-xs text-slate-600">{message}</p>}
  </div>;
}

export function CnpjAlertReadOnly({ status, doNotContact, email }: { status: string; doNotContact: boolean; email: string | null }) {
  return <div className="text-xs text-slate-500">{doNotContact ? "Contato bloqueado" : status === "APROVADO_CONTATO" && !email ? "Sem e-mail" : "Somente visualização"}</div>;
}
