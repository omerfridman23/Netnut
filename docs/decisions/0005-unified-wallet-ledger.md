# ADR-0005: Unified wallet ledger

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

A customer's wallet changes through more than one kind of action — today
**credits** (top-ups) and **consumptions** (product usage), and plausibly more in
the future (refunds, adjustments, transfers, expirations). We need a history of
these actions that is easy to query per customer and easy to extend.

An early design used a separate table per action type. That duplicated structure
(each table needed its own customer link, timestamp, idempotency key, and index)
and made "show me everything that happened to this wallet, in order" require
merging multiple tables.

## Decision

Use a single, generic **`WalletTransaction`** ledger for every wallet movement:

- `type` — `'CREDIT'` or `'CONSUME'` today; new action types can be added without
  a schema change to the table shape.
- `amount` — the signed effect on the balance (positive for credits, negative for
  consumes), so the whole history is one ordered timeline and the balance is a
  single `SUM(amount)`.
- Action-specific fields (`productId`, `quantity`, `unitPrice`) are nullable and
  populated only for the rows that need them.

## Consequences

- **One source of truth, one query:** a customer's full activity is a single
  indexed scan (`WHERE customerId = ? ORDER BY createdAt DESC`), not a merge of
  several tables. The dashboard's history view simply filters by `type`.
- **Extensible:** supporting a new action type (e.g. refund) is a new `type`
  value plus handling, not a new table, relation, and set of indexes.
- **Consistent guarantees for free:** every action type inherits the same
  idempotency (one UNIQUE key column) and the same ordering index.
- **Trade-off:** the table carries nullable, type-specific columns (a credit row
  has no `productId`/`quantity`). We accept a few nullable columns in exchange for
  one simple, extensible, reconcilable history.
