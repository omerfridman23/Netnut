# Usage-Based Billing System

A small but production-shaped usage-based billing system. Customers hold a
prepaid **wallet**; consuming **products** (priced per unit) atomically deducts
from the wallet and records a **consumption event**. The headline feature is
**provably correct wallet accounting under concurrent, multi-instance load**,
all runnable with a single `docker compose up`.

- **Backend:** Node.js + TypeScript + **NestJS** (Module / Controller / Service / Repository), Prisma, SQLite
- **Frontend:** React + TypeScript + Vite + **Material UI** + TanStack React Query
- **Infra:** Docker Compose - one-shot migrate+seed, **two backend replicas** sharing one SQLite file, an nginx gateway load balancer, and an nginx-served SPA

---

## Quick start

```bash
docker compose up --build
```

Then open:

- **Dashboard:** http://localhost:8080
- **API (via gateway):** http://localhost:8081/api  (e.g. http://localhost:8081/api/health)

Boot order is automatic:

1. `migrate` runs `prisma migrate deploy` + seed once against the shared volume, then exits.
2. Two `backend` replicas start (only after migrate succeeds) and become healthy.
3. `gateway` (nginx) load-balances `/api` across both replicas.
4. `frontend` (nginx) serves the SPA and proxies `/api` to the gateway.

> Ports 8080/8081 are used to avoid clashing with anything already on 3000. Adjust in `docker-compose.yml` if needed.
>
> **No environment setup is needed for Docker** — Compose sets the required values and everything else falls back to safe defaults (see `docker-compose.yml` and `backend/src/config/env.ts`). The `backend/.env.example` file documents every available variable and is only needed for [local development without Docker](docs/guides/local-development.md) (`cp backend/.env.example backend/.env`).

---

## Proving it works

The headline guarantee — **correct wallet accounting under concurrent,
multi-instance load** — is not claimed, it is **proven six ways**. Full details
and real output in the **[Testing & proofs guide](docs/guides/testing.md)**.

| Proof | What it proves | Run it |
| --- | --- | --- |
| **Counter-example demo** | The naive read-modify-write *loses money* (99 of 100 charges); the atomic UPDATE is exact | `npm --prefix backend run test:race-demo` |
| **Property-based fuzz** | The invariant holds for **hundreds of random concurrent workloads locally (300) and a thousand in CI** — each a fresh wallet fired concurrently | `npm --prefix backend run test:property` |
| **Concurrency suite** | No overspend, never negative, `balance == history`, no lost events | `npm --prefix backend run test:concurrency` |
| **Idempotency suite** | A retry storm charges **exactly once** | `npm --prefix backend run test:idempotency` |
| **Chaos / fault injection** | Killing a replica mid-load leaves the wallet **penny-perfect** | `npm run chaos` |
| **Runtime metrics** | The machinery is observable — inspect per-replica charges, replays, safe declines, and retry counters | `GET /api/metrics` |

```bash
# 38 automated tests (unit + integration + e2e + property):
cd backend && npm test

# live proofs against the running two-replica stack:
npm run prove     # concurrency + idempotency through the nginx load balancer
npm run chaos     # kill a backend replica mid-load; balance stays exact
```

CI runs the same gates: `backend/npm test` with `PROPERTY_NUM_RUNS=1000`,
`frontend/npm run build`, then a full Docker-stack proof (concurrency,
idempotency, metrics payload validation, and chaos fault-injection).

> Even with a backend replica **killed mid-flight during 300 concurrent
> payments**, the wallet stays consistent to the cent — see the chaos output in
> the [Testing & proofs guide](docs/guides/testing.md).

### End-to-end UI verification (Playwright MCP)

Beyond the automated backend suites, the full dashboard was exercised against the
running `docker compose` stack using the **Playwright MCP** browser-automation
server — driving the real UI exactly as a user would:

- **Forms:** add-funds and record-consumption validation (negative / non-numeric
  / sub-cent inputs blocked, accurate per-error messages, no stale success/error
  alerts), happy-path balance + history updates, and the `Min(1)` quantity guard.
- **Navigation & state:** case-insensitive search, empty-result state, history
  pagination, the not-found-customer page (verified to make a single request per
  query — no retry/poll storm on `4xx`), and the light/dark theme toggle.
- **Live proof:** the `/system` panel's per-replica counters were cross-checked
  against the raw `GET /api/metrics` response and matched exactly.

### Narrated demo video

A complete walkthrough of the platform is included as a short narrated video.
It covers the customer dashboard, customer detail + consumption history,
add-funds flow, recording usage, insufficient-funds decline, light/dark theme,
and the **Live Proof metrics panel**:

- **[`demo/meter-demo.mp4`](demo/meter-demo.mp4)**

---

## Documentation

Full documentation lives in [`docs/`](docs/). Start with the guides, then dig into the decision records for the *why* behind each choice.

### Guides

| Guide | What's inside |
| --- | --- |
| [Architecture](docs/guides/architecture.md) | The Docker Compose topology and how requests flow end to end |
| [Concurrency & data consistency](docs/guides/concurrency-and-consistency.md) | **The headline** - how every decision satisfies "handle concurrent access and guarantee data consistency", plus the atomic-UPDATE deep dive |
| [Idempotency](docs/guides/idempotency.md) | Stripe-style idempotency keys: charge at most once, even under retries |
| [API reference](docs/guides/api-reference.md) | All endpoints, status codes, and response shapes |
| [Data model](docs/guides/data-model.md) | Schema, indexes, and the key data decisions |
| [Seed data](docs/guides/seed-data.md) | The scenarios the seed creates for the dashboard |
| [Testing & proofs](docs/guides/testing.md) | **The six-way proof arsenal** - counter-example demo, property-based fuzz, concurrency + idempotency suites, chaos fault-injection, and runtime metrics |
| [Local development](docs/guides/local-development.md) | Running backend + frontend without Docker |
| [Project structure](docs/guides/project-structure.md) | Where everything lives in the repo |

### Design decisions (ADRs)

Each significant choice is recorded as an Architecture Decision Record in [`docs/decisions/`](docs/decisions/README.md) - the context, the options weighed, what was chosen, and the consequences.

| # | Decision | One-line summary |
| --- | --- | --- |
| [0001](docs/decisions/0001-atomic-guarded-balance-update.md) | Atomic guarded UPDATE | Deduct with `UPDATE ... WHERE balance >= cost` so the wallet can never overspend under concurrency |
| [0002](docs/decisions/0002-ledger-events-and-materialized-balance.md) | Ledger events + materialized balance | Append-only events plus an O(1) `walletBalance` column, written in the same transaction |
| [0003](docs/decisions/0003-sqlite-wal-multi-instance.md) | SQLite (WAL) across replicas | WAL + `busy_timeout` + `connection_limit=1` + retry make one shared file safe for two instances |
| [0004](docs/decisions/0004-idempotency-keys.md) | Client idempotency keys | Stripe-style `Idempotency-Key` + UNIQUE constraint, so retries charge at most once |
| [0006](docs/decisions/0006-frontend-data-freshness.md) | Frontend freshness | React Query invalidate-on-mutation + 10s background polling keeps the dashboard fresh |
| [0007](docs/decisions/0007-full-jitter-retry-backoff.md) | Full-jitter retry backoff | AWS-style full-jitter exponential backoff scatters competing writers off the lock |
| [0008](docs/decisions/0008-proving-correctness-under-concurrency.md) | Proving correctness | Counter-example demo, property-based fuzz, chaos fault-injection, and runtime metrics |

The [ADR index](docs/decisions/README.md) lists the full set and states the system invariant the decisions exist to protect.

---

## Notable trade-offs

- **Reliability over features.** No auth, queues, Redis, or GraphQL - they add complexity without serving the evaluation criteria. The effort went into correctness, clean architecture, and clear documentation instead.
- **SQLite for the assignment**, with the PostgreSQL/MySQL production path documented in [ADR-0003](docs/decisions/0003-sqlite-wal-multi-instance.md).
- **Atomic conditional UPDATE over locking** for the wallet - simpler, portable to any SQL database, and avoids lock-ordering pitfalls.
- **Idempotency keys have no TTL/expiry.** Both consume *and* credit accept a Stripe-style `Idempotency-Key` (stored under a UNIQUE constraint, so a retried request is charged/credited at most once). The stored keys are never garbage-collected, though - a production system would add a periodic cleanup job for old keys.
- **One unified ledger.** Every wallet movement — credits and consumptions — is a row in a single `WalletTransaction` table (`type` = `CREDIT`/`CONSUME`, signed `amount`), written in the same transaction as the balance change. This makes the materialized `walletBalance` reconcilable against the ledger (`startBalance + SUM(amount) == walletBalance`), which a dedicated test asserts. The dashboard's history view shows the `CONSUME` rows.
- **Polling + invalidation over WebSockets.** React Query invalidates affected queries after each mutation (instant feedback on your own actions) and polls every 10s so changes from other users/instances appear without a manual refresh. For instant cross-client push, SSE or WebSockets would be the next step.
- **Every significant choice is documented** as an ADR - see [Design decisions (ADRs)](#design-decisions-adrs) above and the full records in [`docs/decisions/`](docs/decisions/README.md).

---

## Security & known limitations

Security effort went into protecting **data integrity** (the focus of the assignment), not user identity. What's in place:

- **Input validation at the boundary** - every request is validated against a DTO; unknown fields are rejected (`main.ts` global `ValidationPipe`).
- **SQL-injection safe** - all queries go through Prisma; the one raw `UPDATE` uses parameterized `Prisma.sql`.
- **Authoritative server-side pricing** - the client never sends a price; the server reads it from the DB, so prices can't be tampered with.
- **No information leakage** - a global exception filter returns one consistent error shape, logs stack traces server-side only, and keeps the process alive on unhandled errors.
- **Configurable CORS** - locks to an exact origin allow-list in production via `CORS_ORIGINS`.

What is **deliberately out of scope** for this assignment (and would be the next steps for production):

- **No authentication / authorization.** Any caller can hit any endpoint and act on any customer's wallet. Production needs auth (JWT or API keys via a Nest `AuthGuard`) plus per-customer authorization.
- **No rate limiting / throttling.** No protection against brute-force or request floods; add `@nestjs/throttler`, especially on `POST /consumption` and `/credit`.
- **No security headers.** Add `helmet` for HSTS, CSP, `X-Content-Type-Options`, etc.
- **`/api/metrics` is unauthenticated.** It only exposes counters, but should sit behind auth or an internal-only network in production.
- **TLS terminates at the proxy**, not in the app.

The Controller -> Service -> Repository layering means these guards slot in at the controller boundary without touching business logic.
