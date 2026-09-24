CREATE TABLE "Cashbox" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cashbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Cashbox_openingBalance_check" CHECK ("openingBalance" >= 0),
    CONSTRAINT "Cashbox_singleton_check" CHECK ("id" = 'default')
);

CREATE TABLE "CashboxExpense" (
    "id" TEXT NOT NULL,
    "cashboxId" TEXT NOT NULL DEFAULT 'default',
    "requestId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "establishment" VARCHAR(200) NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashboxExpense_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CashboxExpense_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "CashboxExpense_requestId_key" ON "CashboxExpense"("requestId");
CREATE INDEX "CashboxExpense_cashboxId_purchaseDate_createdAt_idx" ON "CashboxExpense"("cashboxId", "purchaseDate", "createdAt");
ALTER TABLE "CashboxExpense" ADD CONSTRAINT "CashboxExpense_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "Cashbox" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
