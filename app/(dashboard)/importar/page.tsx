"use client";

import { useState } from "react";
import { PartnerImport } from "@/components/partners/partner-import";
import { EmissionDateImport } from "@/components/clients/emission-date-import";

type PreviewRow = { line: number; values: Record<string, string>; valid: boolean; errors: string[]; duplicate?: boolean };

export default function Import() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function preview(file: File) {
    setLoading(true);
    setRows([]);
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/imports/preview", { method: "POST", body: data });
    const result = await response.json();
    setLoading(false);
    if (!result.success) {
      setMessage(result.error.message);
      return;
    }
    setRows(result.data.rows);
    setMessage(`${result.data.validCount} registro(s) válido(s) e ${result.data.invalidCount} com pendência(s).`);
  }

  async function save() {
    setLoading(true);
    const response = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const result = await response.json();
    setLoading(false);
    if (!result.success) {
      setMessage(result.error.message);
      return;
    }
    setMessage(`Importação concluída: ${result.data.imported} cliente(s) salvo(s).`);
    setRows([]);
  }

  return <>
    <h2 className="mb-2 text-2xl font-bold">Importar planilhas</h2>
    <p className="mb-6 text-slate-500">Carregue bases de renovações ou parceiros para o sistema.</p>

    <section className="rounded-xl border bg-white p-6">
      <h3 className="font-bold">Base de renovações</h3>
      <p className="mb-4 mt-1 text-sm text-slate-500">Importa clientes para o sistema. Aceita .xlsx e .csv de até 5 MB.</p>
      <input type="file" accept=".xlsx,.csv" disabled={loading} onChange={(event) => event.target.files?.[0] && preview(event.target.files[0])} />
      {message && <p className="mt-4 text-sm font-medium">{message}</p>}
    </section>

    {rows.length > 0 && <section className="mt-5 overflow-auto rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><b>Pré-visualização da base</b><p className="text-sm text-slate-500">Linhas em vermelho não serão importadas.</p></div><button onClick={save} disabled={loading || !rows.some((row) => row.valid)} className="brand-bg rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? "Importando..." : "Importar registros válidos"}</button></div>
      <table><thead><tr><th>Linha</th><th>Cliente</th><th>Pedido</th><th>Produto</th><th>CPF</th><th>CNPJ</th><th>Certificado</th><th>Vencimento</th><th>E-mail</th><th>Validação</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.line} className={row.valid ? "" : "bg-red-50"}><td>{row.line}</td><td>{row.values.name}</td><td>{row.values.orderNumber}</td><td>{row.values.productType}</td><td>{row.values.cpf}</td><td>{row.values.cnpj}</td><td>{row.values.certificateType}</td><td>{row.values.expirationDate}</td><td>{row.values.email}</td><td className={row.valid ? "text-emerald-700" : "text-red-700"}>{row.valid ? "Válido" : row.errors.join("; ")}</td></tr>)}</tbody></table>
    </section>}

    <EmissionDateImport />

    <PartnerImport />

    <section className="mt-6 rounded-xl border bg-white p-6">
      <h3 className="font-bold">Conciliação mensal Certisign</h3>
      <p className="mb-4 mt-1 text-sm text-slate-500">Para comparar pedidos, valores e divergências com a planilha mensal de acerto, use a nova guia de Conciliação.</p>
      <a href="/conciliacao" className="brand-bg inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white">Abrir conciliação de pedidos</a>
    </section>
  </>;
}
