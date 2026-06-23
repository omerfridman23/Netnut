-- Record credits as ledger rows with an optional client-supplied idempotency key.
-- A retried "credit" request carrying the same key is rejected by the UNIQUE
-- index below instead of topping up the wallet a second time (the original
-- credit is replayed). The column is nullable; SQLite treats each NULL as
-- distinct, so unkeyed credits never collide with one another.

-- CreateTable
CREATE TABLE "CreditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditEvent_idempotencyKey_key" ON "CreditEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditEvent_customerId_createdAt_id_idx" ON "CreditEvent"("customerId", "createdAt", "id");
