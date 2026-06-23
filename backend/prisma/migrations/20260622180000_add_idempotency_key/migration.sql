-- Add optional client-supplied idempotency key to consumption events.
-- A retried "consume" request carrying the same key is rejected by this UNIQUE
-- index instead of creating a second charge (the original event is replayed).
-- The column is nullable; SQLite treats each NULL as distinct, so unkeyed
-- requests never collide with one another.
ALTER TABLE "ConsumptionEvent" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionEvent_idempotencyKey_key" ON "ConsumptionEvent"("idempotencyKey");
