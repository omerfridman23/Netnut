# ADR-0004: Client-supplied idempotency keys for consume and credit

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

With thousands of events per minute and at-least-once delivery (dropped
responses, client retries, double-clicks, queue redelivery), a "consume" request
can arrive more than once. Without protection, each duplicate is a second charge.

## Decision

Accept an optional **`Idempotency-Key` HTTP header** (Stripe-style) on
`POST /api/consumption`. The key is stored on the consumption event under a
**UNIQUE** constraint. The same mechanism now also protects
`POST /api/customers/:id/credit`: the key is stored on a `CreditEvent` row
(which doubles as a credit ledger entry) under its own **UNIQUE** constraint, so
a retried top-up credits at most once. Behaviour (identical for both paths):

- **First request:** charges and stores the event with the key. Response
  `replayed: false`.
- **Retry with the same key:** the original event is returned and the wallet is
  **not** charged again. Response `replayed: true`.
- **Concurrent duplicates:** the loser's insert hits the unique constraint inside
  the transaction, which rolls back its balance decrement; it then replays the
  winner's event. Net effect: charged exactly once.

The column is nullable, and SQLite treats every `NULL` as distinct, so requests
without a key never collide.

## Consequences

- Both money-moving endpoints (consume and credit) are now retry-safe under the
  same Stripe-style mechanism. The credit increment and its `CreditEvent` ledger
  row commit in one transaction; a duplicate key rolls back the increment and
  replays the original credit (same race handling as consume).
- Retries are safe; the system is effectively exactly-once from the client's view.
- True idempotency (returns the original result), not just rejection of duplicates.
- Trade-off: a rare concurrent duplicate does a decrement-then-rollback before
  replaying. We accept this because the common sequential-retry case is handled by
  a cheap pre-check with no wasted work.
- Keys are not yet expired/garbage-collected; with more time they would carry a
  TTL and a dedicated table.
