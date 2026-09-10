CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "officeName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "revCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_email_key" ON "Partner"("email");
CREATE UNIQUE INDEX "Partner_revCode_key" ON "Partner"("revCode");
CREATE INDEX "Partner_officeName_idx" ON "Partner"("officeName");
