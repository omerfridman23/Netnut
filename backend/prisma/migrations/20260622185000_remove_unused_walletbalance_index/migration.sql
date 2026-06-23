-- Remove the walletBalance index from Customer.
-- No query in the codebase filters or sorts by walletBalance — the low/empty
-- balance badges are derived client-side from already-fetched rows.
-- A write-only index costs a small update on every credit/consume with no read benefit.
DROP INDEX IF EXISTS "Customer_walletBalance_idx";
