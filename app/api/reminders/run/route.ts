import { prisma } from "@/lib/prisma";
import { sendContact } from "@/lib/contacts/send-contact";
import { demoModeMessage, isDemoMode } from "@/lib/demo-mode";
export async function POST(request: Request) {
  if (isDemoMode()) return Response.json({ error: { message: demoModeMessage } }, { status: 403 });
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: { message: "Não autorizado." } }, { status: 401 });
  const today = new Date(); today.setHours(0, 0, 0, 0); const end = new Date(today); end.setDate(end.getDate() + 90); end.setHours(23, 59, 59, 999);
  const clients = await prisma.client.findMany({ where: { expirationDate: { gte: today, lte: end }, renewalStage: { notIn: ["RENOVADO", "RECUSADO"] } } }); let sent = 0;
  for (const client of clients) { const days = Math.ceil((new Date(client.expirationDate).setHours(0,0,0,0) - today.getTime()) / 86400000); if (![0,30,60,90].includes(days)) continue; const already = await prisma.contactLog.findFirst({ where: { clientId: client.id, type: "EMAIL", status: "SENT", createdAt: { gte: today } } }); if (!already && (await sendContact(client.id, "EMAIL", true)).ok) sent++; }
  return Response.json({ success: true, data: { sent, checked: clients.length } });
}
