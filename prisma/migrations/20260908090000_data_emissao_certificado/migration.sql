-- A data de emissão é independente da data comercial da compra.
-- Ela permite corrigir o vencimento real sem alterar faturamento ou comissões.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Client_issuedAt_idx" ON "Client"("issuedAt");

CREATE TYPE "EmissionDateImportRunStatus" AS ENUM ('PREVIA', 'APLICANDO', 'CONCLUIDO', 'FALHOU');
CREATE TYPE "EmissionDateImportItemStatus" AS ENUM (
  'ATUALIZAR',
  'SEM_ALTERACAO',
  'PEDIDO_NAO_ENCONTRADO',
  'PEDIDO_AMBIGUO',
  'PEDIDO_REPETIDO',
  'DATA_INVALIDA',
  'PEDIDO_RENOVADO',
  'VENCIMENTO_DIVERGENTE',
  'CONFLITO',
  'ATUALIZADO'
);

CREATE TABLE "EmissionDateImportRun" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "importedById" TEXT NOT NULL,
  "status" "EmissionDateImportRunStatus" NOT NULL DEFAULT 'PREVIA',
  "totalRows" INTEGER NOT NULL,
  "updateCount" INTEGER NOT NULL DEFAULT 0,
  "appliedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "EmissionDateImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmissionDateImportItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceLine" INTEGER NOT NULL,
  "sourceOrderNumber" TEXT NOT NULL,
  "matchedOrderNumber" TEXT,
  "clientId" TEXT,
  "sourceIssuedAt" TIMESTAMP(3),
  "sourceExpirationDate" TIMESTAMP(3),
  "previousIssuedAt" TIMESTAMP(3),
  "previousExpirationDate" TIMESTAMP(3),
  "calculatedExpirationDate" TIMESTAMP(3),
  "status" "EmissionDateImportItemStatus" NOT NULL,
  "message" TEXT,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "EmissionDateImportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmissionDateImportItem_runId_sourceLine_key" ON "EmissionDateImportItem"("runId", "sourceLine");
CREATE INDEX "EmissionDateImportRun_importedById_status_createdAt_idx" ON "EmissionDateImportRun"("importedById", "status", "createdAt");
CREATE INDEX "EmissionDateImportRun_fileHash_idx" ON "EmissionDateImportRun"("fileHash");
CREATE INDEX "EmissionDateImportItem_clientId_idx" ON "EmissionDateImportItem"("clientId");
CREATE INDEX "EmissionDateImportItem_runId_status_idx" ON "EmissionDateImportItem"("runId", "status");

ALTER TABLE "EmissionDateImportRun"
  ADD CONSTRAINT "EmissionDateImportRun_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmissionDateImportItem"
  ADD CONSTRAINT "EmissionDateImportItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "EmissionDateImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmissionDateImportItem"
  ADD CONSTRAINT "EmissionDateImportItem_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
