# ADR-0005: Money stored as integer cents

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

Financial values must be exact. Floating-point types (`float`/`double`) cannot
represent many decimal amounts precisely, which leads to rounding drift that is
unacceptable for balances and billing.

## Decision

Store and compute all money as **integer minor units (cents)** end to end:
`Product.unitPrice`, `Customer.walletBalance`, `ConsumptionEvent.unitPrice`,
`totalCost`, and credit amounts are all integers. Formatting to a currency string
happens only at the UI edge.

## API representation (intentional, not a bug)

The HTTP API returns and accepts money as **integer cents**, never decimal
dollars. For example, a $124.90 balance is returned as `12490`, not `124.90`:

```json
{ "id": "...", "name": "Acme", "walletBalance": 12490 }
```

This is a deliberate choice and matches the industry standard for payment APIs
(e.g. **Stripe** represents amounts as integers in the smallest currency unit).
We are explicitly aware that this means API consumers see a "scaled" integer
rather than a human-readable dollar figure — that trade-off is accepted because:

- Returning a JSON number like `124.90` reintroduces the exact floating-point
  drift this decision exists to prevent (e.g. `124.90 + 0.10` is not `125.00`).
- The conversion to a display string (`"$124.90"`) happens once, at the UI edge,
  via the frontend `formatCents` helper, so end users never see raw cents.

**Alternative considered:** add a redundant formatted string field alongside the
integer (e.g. `walletBalance: 12490, walletBalanceDisplay: "$124.90"`). Rejected
for now to keep the payload lean and a single source of truth; it can be added
without breaking the existing integer contract if a non-UI consumer needs it.

## Consequences

- All arithmetic (`unitPrice * quantity`, balance decrement) is exact.
- The atomic guarded UPDATE compares integers, which is precise and index-friendly.
- Trade-off: values are cents in the API and DB, so clients must format for
  display; this is documented and handled by a single `formatCents` helper on the
  frontend.
