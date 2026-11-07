"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

type ManagementContext = "cliente" | "pedido";

export function ClientManagementActions({
  clientId,
  context = "cliente",
  showLabels = false,
}: {
  clientId: string;
  context?: ManagementContext;
  showLabels?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const isOrder = context === "pedido";
  const confirmationMessage = isOrder
    ? "Tem certeza que deseja excluir este pedido?"
    : "Excluir este cliente e o pedido permanentemente? Esta ação não pode ser desfeita.";

  async function remove() {
    if (!window.confirm(confirmationMessage)) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!response.ok) {
        window.alert(`Não foi possível excluir ${isOrder ? "o pedido" : "o cadastro"}.`);
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const controlClassName = showLabels
    ? "inline-flex items-center gap-1 rounded border px-2 py-1.5 text-sm"
    : "rounded border p-1.5";

  return <span className="flex gap-1 border-l border-slate-200 pl-2">
    <Link href={`/clientes/${clientId}/editar`} title={isOrder ? "Editar pedido" : "Editar cadastro"} className={`${controlClassName} text-slate-700`}>
      <Pencil size={16}/>{showLabels && <span>Editar</span>}
    </Link>
    <button type="button" title={isOrder ? "Excluir pedido" : "Excluir cadastro"} disabled={deleting} onClick={remove} className={`${controlClassName} border-red-200 text-red-600 disabled:opacity-50`}>
      <Trash2 size={16}/>{showLabels && <span>{deleting ? "Excluindo..." : "Excluir"}</span>}
    </button>
  </span>;
}
