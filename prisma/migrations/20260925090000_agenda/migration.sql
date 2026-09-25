-- Agenda compartilhada, isolada dos módulos comerciais e financeiros.
CREATE TYPE "AgendaStatus" AS ENUM ('AGENDADO', 'CONCLUIDO', 'CANCELADO');

CREATE TABLE "AgendaEvent" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "notes" VARCHAR(1000),
    "responsibleId" TEXT NOT NULL,
    "createdById" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgendaStatus" NOT NULL DEFAULT 'AGENDADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgendaEvent_date_time_idx" ON "AgendaEvent"("date", "time");
CREATE INDEX "AgendaEvent_responsibleId_date_time_idx" ON "AgendaEvent"("responsibleId", "date", "time");
CREATE INDEX "AgendaEvent_status_date_idx" ON "AgendaEvent"("status", "date");
CREATE UNIQUE INDEX "AgendaEvent_active_responsible_date_time_key" ON "AgendaEvent"("responsibleId", "date", "time") WHERE "status" = 'AGENDADO';

ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
