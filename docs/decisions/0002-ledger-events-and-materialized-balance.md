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

Use option 2. Each `ConsumptionEvent` (debit) and `CreditEvent` (credit) is an
append-only record (never mutated), and `Customer.walletBalance` is a
materialized column updated in the same transaction as the matching event insert
(see ADR-0001).

## Consequences

- Reading a balance is O(1) — a single column — instead of an aggregate over a
  history that can grow to hundreds of thousands of rows per customer.
- History is always available for the UI, with keyset pagination on
  `(customerId, createdAt, id)`.
- Both debit (`ConsumptionEvent`) and credit (`CreditEvent`) ledgers exist, so the
  materialized balance is fully reconcilable:
  `startBalance + SUM(credits) - SUM(consumes) == walletBalance`. A dedicated test
  asserts this against the seed data.
- Trade-off: the balance must always be written in the same transaction as the
  event, or the two could diverge. We accept this coupling for the read speed.
