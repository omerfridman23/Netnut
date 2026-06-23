# ADR-0002: Ledger events + materialized balance

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

The dashboard needs a per-customer consumption history, and we need to be able to
trust (and audit) the wallet balance. Two models were considered:

1. **Derived balance:** store only immutable events; compute the balance as
   `SUM(amount)` on every read.
2. **Materialized balance:** store immutable events *and* a `walletBalance` column
   that is updated alongside each event.

## Decision

Use option 2 with a **single unified ledger**. Every wallet movement — both
credits and consumptions — is an append-only row in one `WalletTransaction` table
(`type` = `CREDIT` | `CONSUME`, with a signed `amount`: positive for credits,
negative for consumes). `Customer.walletBalance` is a materialized column updated
in the same transaction as the matching ledger row (see ADR-0001).

## Consequences

- Reading a balance is O(1) — a single column — instead of an aggregate over a
  history that can grow to hundreds of thousands of rows per customer.
- History is always available for the UI, with keyset pagination on
  `(customerId, createdAt, id)`.
- One ledger holds both credits and consumes, so the materialized balance is
  fully reconcilable with a single sum: `startBalance + SUM(amount) ==
  walletBalance`. A dedicated test asserts this against the seed data.
- The dashboard's consumption-history view simply filters the ledger to
  `type = 'CONSUME'`, served by the `(customerId, createdAt, id)` index.
- Trade-off: the balance must always be written in the same transaction as the
  event, or the two could diverge. We accept this coupling for the read speed.
