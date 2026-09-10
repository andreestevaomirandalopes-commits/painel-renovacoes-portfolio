import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export async function audit(input:{actorUserId?:string|null;action:string;entity:string;entityId?:string|null;details?:Record<string,unknown>}){return prisma.auditLog.create({data:{actorUserId:input.actorUserId||null,action:input.action,entity:input.entity,entityId:input.entityId||null,details:input.details as Prisma.InputJsonValue|undefined}})}
