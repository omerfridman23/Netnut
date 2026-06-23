# ADR-0001: Atomic guarded UPDATE for wallet consistency

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

A single customer may generate thousands of consumption events per minute, and
multiple backend instances run at once. The wallet balance must stay correct and
must never go negative under this concurrency.

The naive approach — read the balance into the app, subtract the cost in code,
write it back — has a lost-update race: two concurrent requests read the same
balance and one write overwrites the other. It also allows overdraft. An
in-process mutex/lock does **not** fix this, because it only serializes one
instance, not all of them.

## Decision

Push the invariant into the database as a single conditional statement:

```sql
UPDATE "Customer"
SET "walletBalance" = "walletBalance" - :cost
WHERE "id" = :id AND "walletBalance" >= :cost;
```

The number of affected rows is the outcome: `1` = charged, `0` = either the
customer doesn't exist or funds were insufficient. There is no read-then-write
window. The event insert happens in the **same transaction**, so balance and
history commit together or not at all.

## Consequences

- Correct under concurrency on any database that serializes this write, including
  across multiple instances — the safety lives in the DB, not app memory.
- Overdraft is structurally impossible (the `WHERE` guard).
- Slightly more code than `prisma.update`, and the guard uses `$executeRaw`
  because Prisma's typed `update` cannot express a conditional `WHERE balance >= cost`.
