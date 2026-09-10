CREATE TYPE "CnpjAlertStatus" AS ENUM ('NOVO', 'EM_ANALISE', 'APROVADO_CONTATO', 'CONTATADO', 'DESCARTADO');

CREATE TABLE "CnpjAlert" (
  "id" TEXT NOT NULL,
  "cnpj" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "openingDate" TIMESTAMP(3),
  "registrationStatus" TEXT,
  "cnae" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CnpjAlertStatus" NOT NULL DEFAULT 'NOVO',
  "doNotContact" BOOLEAN NOT NULL DEFAULT false,
  "contactSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CnpjAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CnpjAlertActivity" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CnpjAlertActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CnpjAlertContactLog" (
  "id" TEXT NOT NULL,
  "alertId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
  "providerResponse" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CnpjAlertContactLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CnpjAlert_cnpj_key" ON "CnpjAlert"("cnpj");
CREATE INDEX "CnpjAlert_status_idx" ON "CnpjAlert"("status");
CREATE INDEX "CnpjAlert_openingDate_idx" ON "CnpjAlert"("openingDate");
CREATE INDEX "CnpjAlert_city_state_idx" ON "CnpjAlert"("city", "state");
CREATE INDEX "CnpjAlert_receivedAt_idx" ON "CnpjAlert"("receivedAt");
CREATE INDEX "CnpjAlertActivity_alertId_createdAt_idx" ON "CnpjAlertActivity"("alertId", "createdAt");
CREATE INDEX "CnpjAlertContactLog_alertId_createdAt_idx" ON "CnpjAlertContactLog"("alertId", "createdAt");
CREATE INDEX "CnpjAlertContactLog_createdAt_idx" ON "CnpjAlertContactLog"("createdAt");

ALTER TABLE "CnpjAlertActivity" ADD CONSTRAINT "CnpjAlertActivity_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "CnpjAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CnpjAlertActivity" ADD CONSTRAINT "CnpjAlertActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CnpjAlertContactLog" ADD CONSTRAINT "CnpjAlertContactLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "CnpjAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CnpjAlertContactLog" ADD CONSTRAINT "CnpjAlertContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
