"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

type PreviewRow = {
  line: number;
  values: { cnpj: string; legalName: string; openingDate?: string; city: string; state: string; email?: string; source: string };
  valid: boolean;
  errors: string[];
  existing?: boolean;
};

export function CnpjAlertImport() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function preview(file: File) {
    setLoading(true);
    setRows([]);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/cnpj-alerts/import/preview", { method: "POST", body: form });
    const result = await response.json();
    setLoading(false);
    if (!result.success) return setMessage(result.error.message);
    setRows(result.data.rows);
    setMessage(`${result.data.validCount} alerta(s) válido(s), ${result.data.existingCount} atualização(ões) e ${result.data.invalidCount} pendência(s).`);
  }

  async function save() {
    setLoading(true);
    const response = await fetch("/api/cnpj-alerts/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const result = await response.json();
    setLoading(false);
    if (!result.success) return setMessage(result.error.message);
    setMessage(`Importação concluída: ${result.data.created} novo(s) alerta(s) e ${result.data.updated} atualizado(s).`);
    setRows([]);
    window.setTimeout(() => window.location.reload(), 700);
  }

  return <section className="bg-white border rounded-xl overflow-hidden">
    <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50">
      <span><span className="flex items-center gap-2 font-bold"><FileSpreadsheet size={19} className="brand-text" />Importar empresas para alertas</span><span className="block mt-1 text-sm font-normal text-slate-500">Teste o fluxo com uma planilha antes de contratar qualquer API.</span></span>
      <span className="text-sm brand-text font-semibold">{open ? "Fechar" : "Importar"}</span>
    </button>
    {open && <div className="border-t p-5 space-y-4">
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600"><b className="text-slate-800">Obrigatórias:</b> CNPJ, Razão Social, Data de Abertura, Cidade e UF.<br /><b className="text-slate-800">Opcionais:</b> Nome Fantasia, CNAE, E-mail, Telefone e Situação Cadastral.<br /><a href="/modelos/modelo-alertas-cnpj.csv" download className="mt-2 inline-block brand-text font-semibold underline">Baixar modelo de planilha</a></div>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-slate-600 hover:border-slate-400">
        <Upload size={18} /> {loading ? "Lendo planilha..." : "Selecionar planilha .xlsx ou .csv"}
        <input className="sr-only" type="file" accept=".xlsx,.csv" disabled={loading} onChange={(event) => event.target.files?.[0] && preview(event.target.files[0])} />
      </label>
      {message && <p className={`text-sm font-medium ${rows.length ? "text-slate-700" : "text-red-700"}`}>{message}</p>}
      {rows.length > 0 && <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border"><table><thead><tr><th>Linha</th><th>CNPJ</th><th>Razão social</th><th>Abertura</th><th>Local</th><th>Situação</th></tr></thead><tbody>{rows.slice(0, 30).map((row) => <tr key={row.line} className={row.valid ? "" : "bg-red-50"}><td>{row.line}</td><td>{row.values.cnpj}</td><td>{row.values.legalName}</td><td>{row.values.openingDate}</td><td>{row.values.city} - {row.values.state}</td><td className={row.valid ? row.existing ? "text-amber-700" : "text-emerald-700" : "text-red-700"}>{row.valid ? row.existing ? "Atualizar existente" : "Novo alerta" : row.errors.join("; ")}</td></tr>)}</tbody></table></div>
        {rows.length > 30 && <p className="text-xs text-slate-500">Prévia limitada às primeiras 30 linhas.</p>}
        <button type="button" onClick={save} disabled={loading || !rows.some((row) => row.valid)} className="brand-bg rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Salvando..." : "Importar alertas válidos"}</button>
      </div>}
    </div>}
  </section>;
}
