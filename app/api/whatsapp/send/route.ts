import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { sendContact } from "@/lib/contacts/send-contact";
export async function POST(request: Request) { const parsed = z.object({ clientId:z.string().min(1) }).safeParse(await request.json()); if (!parsed.success) return fail("INVALID_REQUEST", "Cliente inválido."); const result = await sendContact(parsed.data.clientId, "WHATSAPP"); return result.ok ? ok({ message:result.message }) : fail(result.code || "SEND_FAILED", result.message, result.code === "UNAUTHORIZED" ? 401 : 400); }
