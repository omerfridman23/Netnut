# Data model

Relationships: one Customer has many ConsumptionEvents; one Product appears in many ConsumptionEvents.

```text
Customer                          Product
--------                          -------
id            (PK)                id         (PK)
name                              name
walletBalance (cents)            unitPrice  (cents)
   |                                 |
   | has many                        | appears in many
   |                                 |
   +------------> ConsumptionEvent <-+
                  ----------------
                  id             (PK)
                  customerId     (FK -> Customer.id)
                  productId      (FK -> Product.id)
                  quantity
                  unitPrice      (snapshot, cents)
                  totalCost      (cents)
                  idempotencyKey (unique, nullable)
                  createdAt
```

Schema notes (the *why* behind these lives in the linked ADRs below):

- **Money as integer cents** in every money column (`walletBalance`, `unitPrice`, `totalCost`).
- **Price snapshot**: each event stores its own `unitPrice` and `totalCost`, captured at the moment of consumption.
- **Indexes** (all on `ConsumptionEvent`, the only high-volume table):
  - `(customerId, createdAt, id)` - supports fast ordered queries on a customer's history.
  - `(productId)` - backs the foreign key (SQLite does not auto-index FKs).
  - `idempotencyKey` (unique) - enforces at-most-once charging and speeds up replay lookups.
- **Offset/limit pagination** for history (returns `total`); simple limits for the small product/customer lists.

## Related ADRs

- [ADR-0002: Ledger events + materialized balance](../decisions/0002-ledger-events-and-materialized-balance.md)
- [ADR-0005: Money stored as integer cents](../decisions/0005-money-as-integer-cents.md)

---

[Back to README](../../README.md) | [All guides](./)
