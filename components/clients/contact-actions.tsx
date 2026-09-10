"use client";
import { useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
export function ContactActions({ clientId }: { clientId:string }) {
  const [message,setMessage] = useState(""); const [loading,setLoading] = useState<"email"|"whatsapp"|null>(null);
  async function send(kind:"email"|"whatsapp") { setLoading(kind); setMessage(""); const response = await fetch(`/api/${kind}/send`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ clientId }) }); const json=await response.json(); setLoading(null); setMessage(json.success ? json.data.message : json.error.message); }
  return <div className="min-w-36"><div className="flex gap-2"><button title="Enviar e-mail" disabled={!!loading} onClick={()=>send("email")} className="border rounded p-1.5 text-slate-700 disabled:opacity-50"><Mail size={16}/></button><button title="Enviar WhatsApp" disabled={!!loading} onClick={()=>send("whatsapp")} className="border rounded p-1.5 text-emerald-700 disabled:opacity-50"><MessageCircle size={16}/></button></div>{message&&<p className="text-xs mt-1 text-slate-600">{message}</p>}</div>;
}
