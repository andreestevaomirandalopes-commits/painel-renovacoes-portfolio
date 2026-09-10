CREATE TYPE "ReconciliationStatus" AS ENUM ('CONFERIDO', 'DIVERGENTE', 'SOMENTE_PAINEL', 'SOMENTE_CERTISIGN', 'REVISAO_MANUAL', 'IGNORADO');
CREATE TYPE "ComparisonStatus" AS ENUM ('CONFERE', 'DIFERENTE', 'NAO_DISPONIVEL');
CREATE TYPE "ReconciliationReviewStatus" AS ENUM ('PENDENTE', 'REVISADO', 'IGNORADO');

CREATE TABLE "ReconciliationRun" (
  "id" TEXT NOT NULL,
  "competence" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'Certisign',
  "fileName" TEXT NOT NULL,
  "sheetName" TEXT,
  "fileHash" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedById" TEXT,
  "totalSourceRows" INTEGER NOT NULL,
  "validSourceRows" INTEGER NOT NULL,
  "invalidSourceRows" INTEGER NOT NULL DEFAULT 0,
  "ignoredSourceRows" INTEGER NOT NULL DEFAULT 0,
  "totalItems" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceLine" INTEGER,
  "clientId" TEXT,
  "externalOrderNumber" TEXT,
  "externalEntityCode" TEXT,
  "externalEntityName" TEXT,
  "externalVendorCode" TEXT,
  "externalVendorName" TEXT,
  "externalProductCode" TEXT,
  "externalProductName" TEXT,
  "externalOrderStatus" TEXT,
  "externalOrderDate" TIMESTAMP(3),
  "externalRenewalDate" TIMESTAMP(3),
  "externalPreviousOrder" TEXT,
  "externalClientName" TEXT,
  "externalVoucherType" TEXT,
  "externalGrossAmount" DECIMAL(12,2),
  "externalBillingAmount" DECIMAL(12,2),
  "externalCommissionAmount" DECIMAL(12,2),
  "externalCount" INTEGER,
  "rawData" JSONB,
  "systemOrderNumber" TEXT,
  "systemClientName" TEXT,
  "systemCpf" TEXT,
  "systemCnpj" TEXT,
  "systemValue" DECIMAL(12,2),
  "systemProductType" "ProductType",
  "systemCertificateType" "CertificateType",
  "systemA3Model" "A3Model",
  "systemPartnerRevCode" TEXT,
  "systemPartnerName" TEXT,
  "status" "ReconciliationStatus" NOT NULL,
  "valueStatus" "ComparisonStatus" NOT NULL DEFAULT 'NAO_DISPONIVEL',
  "productStatus" "ComparisonStatus" NOT NULL DEFAULT 'NAO_DISPONIVEL',
  "partnerStatus" "ComparisonStatus" NOT NULL DEFAULT 'NAO_DISPONIVEL',
  "differences" JSONB,
  "reviewStatus" "ReconciliationReviewStatus" NOT NULL DEFAULT 'PENDENTE',
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationRun_competence_fileHash_key" ON "ReconciliationRun"("competence", "fileHash");
CREATE INDEX "ReconciliationRun_competence_importedAt_idx" ON "ReconciliationRun"("competence", "importedAt");
CREATE INDEX "ReconciliationRun_importedAt_idx" ON "ReconciliationRun"("importedAt");
CREATE UNIQUE INDEX "ReconciliationItem_runId_sourceLine_key" ON "ReconciliationItem"("runId", "sourceLine");
CREATE INDEX "ReconciliationItem_runId_status_idx" ON "ReconciliationItem"("runId", "status");
CREATE INDEX "ReconciliationItem_runId_reviewStatus_idx" ON "ReconciliationItem"("runId", "reviewStatus");
CREATE INDEX "ReconciliationItem_externalOrderNumber_idx" ON "ReconciliationItem"("externalOrderNumber");
CREATE INDEX "ReconciliationItem_clientId_idx" ON "ReconciliationItem"("clientId");

ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
