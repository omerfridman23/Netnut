# Concurrency & data consistency

This is the project's headline guarantee: **provably correct wallet accounting under concurrent, multi-instance load**. This guide first maps every decision back to the requirement, then explains the core mechanism in depth.

## How this satisfies "handle concurrent access and guarantee data consistency"

This requirement drove nearly every engineering decision in the project. The tables below map each decision to the requirement and to where it lives in the code.

### Correct concurrency (the core requirement)

| Decision | What it prevents | Where |
| --- | --- | --- |
| **Atomic conditional `UPDATE ... WHERE balance >= cost`** | The read-modify-write race that lets two concurrent requests both pass a stale balance check and overspend the wallet | `consumption.repository.ts` |
| **Deduction + event insert in one transaction** | Partial state - money taken but no history row written (or vice-versa) | `consumption.repository.ts` |
| **Atomic `increment` for credits** | Lost updates when two top-ups race against each other | `customers.repository.ts` |
| **WAL + `busy_timeout` + `connection_limit=1`** | Readers blocking the writer; instant `SQLITE_BUSY` failures; in-process connection-pool races | `prisma.service.ts`, `DATABASE_URL` |
| **Full-jitter exponential backoff retry (capped, env-configurable)** | Thundering-herd retries re-colliding on the write lock after a `SQLITE_BUSY` | `common/errors/retry.ts`, `config/env.ts` |
| **Two backend replicas sharing one DB file** | Proves multi-instance safety - we run it, not just claim it | `docker-compose.yml`, `gateway/nginx.conf` |
| **One-shot migrate+seed container** | Two replicas racing to apply migrations at startup | `docker-compose.yml` |

### Data integrity

| Decision | What it prevents | Where |
| --- | --- | --- |
| **Money as integer cents everywhere** | Precision loss in financial calculations | `schema.prisma` |
| **Price snapshot (`unitPrice`, `totalCost`) on each event** | History silently changing when a product's price is updated later | `schema.prisma`, `consumption.service.ts` |
| **Foreign keys ON, Cascade/Restrict rules** | Orphaned events; deleting a product that already has sales history | `schema.prisma` |
| **Idempotency key + UNIQUE constraint** | Double-charging on client retries or dropped HTTP responses | `schema.prisma`, `consumption.repository.ts` |
| **Authoritative server-side pricing** | Clients manipulating the price they are charged | `consumption.service.ts` |

### API correctness and robustness

| Decision | What it gives us | Where |
| --- | --- | --- |
| **Distinct HTTP status codes (201 / 400 / 404 / 422)** | Meaningful, machine-branchable responses - "invalid request" vs "not found" vs "no funds" are different signals | `common/errors/app.errors.ts` |
| **One central error shape via a global exception filter** | Consistent errors across every endpoint; no stack-trace leaks; the process never crashes on an unhandled error | `common/filters/all-exceptions.filter.ts` |
| **Validation at the boundary** | Bad input is rejected before any business logic runs | `main.ts`, DTOs |
| **Offset/limit pagination with a total count** | Bounded payloads and page-navigation support as history grows | `common/dto/pagination.dto.ts` |

### Operational maturity

| Decision | What it gives us | Where |
| --- | --- | --- |
| **Strict Controller -> Service -> Repository layering** | DB details never leak past the repository; the engine is swappable to MySQL/Postgres | every feature module |
| **Centralized, validated env config** | All contention knobs (`busy_timeout`, retry count, delay cap) tunable without recompiling; bad values fail at boot | `config/env.ts` |
| **DB-backed health check (503 when the DB is unreachable)** | Orchestrators and load-balancers can pull an unhealthy replica out of rotation | `health/health.controller.ts` |
| **Read-only `/api/metrics` per replica** | Makes the concurrency machinery observable - watch `dbRetries` climb under load while accounting stays exact | `common/metrics/` |
| **Six-way proof that it's correct** | A counter-example demo (naive *loses* money), property-based fuzz (hundreds of random concurrent workloads locally, a thousand in CI), the concurrency + idempotency suites, chaos fault-injection (kill a replica mid-load), and runtime metrics - see the [Testing & proofs guide](./testing.md) | `test/`, `scripts/`, `/api/metrics` |

> **The thesis:** the central design goal is *correct wallet accounting under concurrent, multi-instance load*. The race is solved at the database level with an atomic conditional UPDATE (not application locks), proven across two live replicas and backed by a concurrency test. Everything else - integer cents, price snapshotting, FK constraints, idempotency, full-jitter retries - protects data integrity around that core, in a layered architecture that ports directly to MySQL/PostgreSQL.

---

## The core problem: concurrency

A single customer may generate thousands of consumption events per minute, and multiple backend instances run at once. The classic bug is a **read-modify-write race**: two requests both read the same balance, both decide there are enough funds, and both deduct - overspending the wallet (negative balance).

### The fix: atomic conditional UPDATE

We never read-then-write. The deduction is a single conditional statement:

```sql
UPDATE Customer
SET walletBalance = walletBalance - :cost
WHERE id = :id AND walletBalance >= :cost;
```

SQLite evaluates this atomically and serializes writers, so two concurrent requests can never both pass the guard on a stale balance. The number of **rows affected** decides the outcome:

- `1` -> success: the decrement applied.
- `0` -> either the customer doesn't exist, or funds were insufficient (we then do one read to distinguish 404 vs 422).

On success, the consumption event is inserted in the **same transaction**, so the balance and history are always consistent (all-or-nothing). Crediting a wallet is likewise a single atomic `walletBalance = walletBalance + :amount` update.

```text
1. User -> API : POST /api/consumption (customer, product, quantity)
2. API        : validate input and read the product price
3. API -> DB  : BEGIN transaction
4. API -> DB  : deduct cost ONLY IF balance is enough

   IF balance was enough (1 row updated):
     5. API -> DB   : insert consumption event (snapshot the price)
     6. API -> DB   : COMMIT (save both changes together)
     7. API -> User : 201 Created + new balance

   ELSE not enough money, or unknown customer (0 rows updated):
     5. API -> DB   : ROLLBACK (undo everything)
     6. API -> User : 422 Insufficient funds (or 404 Not found)
```

**How to read this:** the deduction and the history record happen inside one transaction, so they either both succeed or both get undone. The key trick is step 4 - the database deducts money *only if* there is enough, in a single step no other request can interrupt.

### SQLite settings that make this safe and smooth

Applied on connect in [`prisma.service.ts`](../../backend/src/prisma/prisma.service.ts):

- `journal_mode = WAL` - readers don't block the single writer (faster dashboards).
- `busy_timeout = 5000` - a writer waits (and retries internally) for the lock instead of failing immediately.
- `foreign_keys = ON` - enforce referential integrity (off by default in SQLite).
- `connection_limit=1` in `DATABASE_URL` - one connection per process, so the PRAGMAs reliably govern all access (no pool contention).

A small [`withRetry`](../../backend/src/common/errors/retry.ts) wrapper retries the rare residual `SQLITE_BUSY` / write-conflict with full-jitter exponential backoff - safe because the whole write is one atomic transaction. See [ADR-0007](../decisions/0007-full-jitter-retry-backoff.md).

### SQLite limitations & the production path

SQLite is single-writer and file-locking based, so it is not built for true horizontal scale. The same design ports directly to PostgreSQL/MySQL. The rationale, the alternatives considered (`SELECT ... FOR UPDATE`, an optimistic `version` column, connection pooling, read replicas), and the migration path are covered in [ADR-0003](../decisions/0003-sqlite-wal-multi-instance.md).

## Related ADRs

- [ADR-0001: Atomic guarded UPDATE](../decisions/0001-atomic-guarded-balance-update.md)
- [ADR-0002: Ledger events + materialized balance](../decisions/0002-ledger-events-and-materialized-balance.md)
- [ADR-0003: SQLite (WAL) with multiple backend instances](../decisions/0003-sqlite-wal-multi-instance.md)
- [ADR-0007: Full-jitter retry backoff](../decisions/0007-full-jitter-retry-backoff.md)
- [ADR-0008: Proving correctness under concurrency](../decisions/0008-proving-correctness-under-concurrency.md)

---

[Back to README](../../README.md) | [All guides](./)
