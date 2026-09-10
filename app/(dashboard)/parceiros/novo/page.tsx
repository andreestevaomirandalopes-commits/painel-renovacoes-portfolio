import { PartnerForm } from "@/components/partners/partner-form";
import Link from "next/link";
export default function NewPartner(){return <><div className="flex items-center gap-4 mb-6"><Link href="/parceiros" className="text-sm brand-text">← Voltar</Link><h2 className="text-2xl font-bold">Novo parceiro</h2></div><PartnerForm/></>}
