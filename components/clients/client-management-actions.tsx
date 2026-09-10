"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export function ClientManagementActions({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    if (!window.confirm("Excluir este cliente e o pedido permanentemente? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) { window.alert("Não foi possível excluir o cadastro."); return; }
    router.refresh();
  }
  return <span className="flex gap-1 border-l border-slate-200 pl-2"><Link href={`/clientes/${clientId}/editar`} title="Editar cadastro" className="rounded border p-1.5 text-slate-700"><Pencil size={16}/></Link><button type="button" title="Excluir cadastro" disabled={deleting} onClick={remove} className="rounded border border-red-200 p-1.5 text-red-600 disabled:opacity-50"><Trash2 size={16}/></button></span>;
}
