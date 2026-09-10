-- Permite importar a mesma planilha em dois fluxos independentes: pedidos e parceiros.
CREATE TYPE "ReconciliationKind" AS ENUM ('PEDIDOS', 'PARCEIROS');

ALTER TABLE "ReconciliationRun"
  ADD COLUMN "kind" "ReconciliationKind" NOT NULL DEFAULT 'PEDIDOS';

DROP INDEX "ReconciliationRun_competence_fileHash_key";

CREATE UNIQUE INDEX "ReconciliationRun_competence_kind_fileHash_key"
  ON "ReconciliationRun"("competence", "kind", "fileHash");

CREATE INDEX "ReconciliationRun_kind_competence_importedAt_idx"
  ON "ReconciliationRun"("kind", "competence", "importedAt");

ALTER TABLE "ReconciliationItem"
  ADD COLUMN "commissionAppliedAt" TIMESTAMP(3),
  ADD COLUMN "commissionAppliedById" TEXT,
  ADD COLUMN "commissionAppliedPartnerId" TEXT;

CREATE INDEX "ReconciliationItem_commissionAppliedPartnerId_idx"
  ON "ReconciliationItem"("commissionAppliedPartnerId");

CREATE TABLE "CertisignPartnerMapping" (
  "id" TEXT NOT NULL,
  "externalVendorCode" TEXT NOT NULL,
  "externalVendorName" TEXT,
  "partnerId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertisignPartnerMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertisignPartnerMapping_externalVendorCode_key"
  ON "CertisignPartnerMapping"("externalVendorCode");

CREATE INDEX "CertisignPartnerMapping_partnerId_idx"
  ON "CertisignPartnerMapping"("partnerId");

ALTER TABLE "ReconciliationItem"
  ADD CONSTRAINT "ReconciliationItem_commissionAppliedById_fkey"
  FOREIGN KEY ("commissionAppliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReconciliationItem"
  ADD CONSTRAINT "ReconciliationItem_commissionAppliedPartnerId_fkey"
  FOREIGN KEY ("commissionAppliedPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CertisignPartnerMapping"
  ADD CONSTRAINT "CertisignPartnerMapping_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertisignPartnerMapping"
  ADD CONSTRAINT "CertisignPartnerMapping_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
