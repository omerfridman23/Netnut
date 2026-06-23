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

Use option 2. Each `ConsumptionEvent` is an append-only record (never mutated),
and `Customer.walletBalance` is a materialized column updated in the same
transaction as the event insert (see ADR-0001).

## Consequences

- Reading a balance is O(1) — a single column — instead of an aggregate over a
  history that can grow to hundreds of thousands of rows per customer.
- History is always available for the UI, with keyset pagination on
  `(customerId, createdAt, id)`.
- Consumption history is always available for the UI with keyset pagination.
- Trade-off: only consumption events are recorded. Credits update the balance
  atomically but do not write a history row. Full reconciliation
  (`SUM(debits + credits) == walletBalance`) would require a credit event table —
  a known gap documented as future work.
- Trade-off: the balance must always be written in the same transaction as the
  event, or the two could diverge. We accept this coupling for the read speed.
