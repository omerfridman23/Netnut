# Data model

A single **unified ledger** (`WalletTransaction`) records every wallet movement —
credits (top-ups) and consumptions. One Customer has many transactions; one
Product appears in the `CONSUME` transactions.

```text
Customer                          Product
--------                          -------
id            (PK)                id         (PK)
name                              name
walletBalance (cents)            unitPrice  (cents)
   |                                 |
   | has many                        | appears in many (CONSUME rows)
   |                                 |
   +-----------> WalletTransaction <-+
                 -----------------
                 id             (PK)
                 customerId     (FK -> Customer.id)
                 type           ('CREDIT' | 'CONSUME')
                 amount         (signed cents: + credit, - consume)
                 productId      (FK -> Product.id, NULL for credits)
                 quantity       (NULL for credits)
                 unitPrice      (snapshot, NULL for credits)
                 idempotencyKey (unique, nullable)
                 createdAt
```

Schema notes (the *why* behind these lives in the linked ADRs below):

- **Unified ledger**: credits and consumes share one table, so the balance
  reconciles with a single sum: `startBalance + SUM(amount) == walletBalance`.
- **Money as integer cents** in every money column (`walletBalance`, `unitPrice`, `amount`).
- **Price snapshot**: each `CONSUME` row stores its own `unitPrice`, captured at the moment of consumption.
- **Indexes** (all on `WalletTransaction`, the only high-volume table):
  - `(customerId, createdAt, id)` - per-customer history, newest first (each customer sees only their own rows).
  - `(productId)` - backs the foreign key (SQLite does not auto-index FKs).
  - `idempotencyKey` (unique) - enforces at-most-once credit/consume and speeds up replay lookups.
- **Offset/limit pagination** for history (returns `total`); simple limits for the small product/customer lists.

## Related ADRs

- [ADR-0002: Ledger events + materialized balance](../decisions/0002-ledger-events-and-materialized-balance.md)
- [ADR-0005: Money stored as integer cents](../decisions/0005-money-as-integer-cents.md)

---

[Back to README](../../README.md) | [All guides](./)
