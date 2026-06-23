# Testing & proofs

Correctness here is **not claimed — it is proven, six ways.** The core requirement
(*handle concurrent access and guarantee data consistency*) is the hardest thing
to get right, so the bulk of the testing effort attacks it from every angle: a
demonstrated counter-example, randomized adversarial input, infrastructure
failure, and live observability — all against a **real database** (never mocked,
because the race condition lives in the DB layer; a mocked test would give false
confidence).

## The proof arsenal at a glance

| # | Proof | What it proves | Where | Run it |
| - | --- | --- | --- | --- |
| 1 | **Counter-example demo** | The naive read-modify-write *loses money*; the atomic UPDATE is exact — shows *why* the design is necessary | `test/e2e/race-demo.e2e.spec.ts` | `npm run test:race-demo` |
| 2 | **Property-based fuzz** | The invariant holds for **hundreds of random concurrent workloads locally (300), a thousand in CI** — not a few hand-picked ones | `test/property/wallet.property.spec.ts` | `npm run test:property` |
| 3 | **Concurrency suite** | No overspend, never negative, balance == history, no lost events, customer isolation | `test/e2e/concurrency.e2e.spec.ts` | `npm run test:concurrency` |
| 4 | **Idempotency suite** | A retry storm with one key charges **exactly once** | `test/e2e/idempotency.e2e.spec.ts` | `npm run test:idempotency` |
| 5 | **Chaos / fault injection** | Killing a replica mid-load leaves the wallet **perfectly consistent** | `scripts/chaos-check.mjs` | `npm run chaos` |
| 6 | **Runtime metrics** | The concurrency machinery is **observable** — inspect per-replica charged/replayed/declined counters and the retry safety net | `GET /api/metrics` | see below |

Plus the live, multi-instance proofs (`npm run prove`) that run against the real
two-replica Docker stack through the nginx load balancer.

**38 automated tests pass** across unit, integration, e2e, and property suites.

```bash
cd backend
npm test                  # full suite (38 tests)
npm run test:unit         # fast, no I/O
npm run test:integration  # service + repository + real SQLite, no HTTP
npm run test:e2e          # full HTTP through the app
npm run test:concurrency  # the headline consistency suite
npm run test:idempotency  # idempotency over HTTP
npm run test:race-demo    # the naive-vs-atomic counter-example
npm run test:property     # property-based fuzz (random concurrent workloads)
```

```
test/
  unit/         retry.spec.ts            - withRetry: retries SQLITE_BUSY, gives up on real errors
  integration/  consumption.int.spec.ts  - consume math, price snapshot, insufficient/not-found, idempotency replay
                customers.int.spec.ts     - atomic credit, not-found
  e2e/          concurrency.e2e.spec.ts   - THE consistency proof
                idempotency.e2e.spec.ts   - Stripe-style idempotency over HTTP
                race-demo.e2e.spec.ts     - naive read-modify-write LOSES money; atomic is exact
                api.e2e.spec.ts           - HTTP contract: status codes, validation, error shape, pagination
  property/     wallet.property.spec.ts   - random concurrent workloads, invariant holds for ALL of them
  helpers/      test-app.ts               - boots a real Nest app on an isolated SQLite db
```

---

## 1. Counter-example: show the bug, then show the fix

Most submissions *claim* "no race condition." This one **demonstrates the bug
happening**, then proves the fix — same workload, two implementations:

- **Naive** — read the balance into the app, subtract in JS, write it back.
  Concurrent requests read the same stale value and overwrite each other →
  **lost updates** (money silently kept).
- **Correct** — the real atomic guarded `UPDATE ... WHERE balance >= cost` inside
  a transaction. No read-modify-write window exists.

Actual output (`npm run test:race-demo`):

```
=== RACE DEMO: naive read-modify-write vs atomic UPDATE ===
Workload: 100 concurrent deductions of 5c on a 500c wallet

NAIVE  (read-modify-write):
  deductions the app thought it applied : 100
  balance if those were all counted     : 0c
  ACTUAL final balance                  : 495c
  lost updates (money silently kept)    : 495c  <-- BUG

CORRECT (atomic guarded UPDATE):
  successful charges (201)              : 100
  events recorded                       : 100
  final balance                         : 0c
  expected (start - ok*price)           : 0c
===========================================================
```

The naive path lost **99 of 100 charges**. The atomic path is exact. This is the
single most convincing artifact in the project: it makes the danger visible.

## 2. Property-based fuzz: prove it for *any* workload

Example tests check a few scenarios. The property test (`fast-check`) generates
**many random mixes** of credits and consumptions, fires each mix concurrently,
and asserts the invariant for **every** generated case:

1. `finalBalance == startBalance + Σ(successful credits) − Σ(successful consumes)`
2. `finalBalance >= 0` (never overdraft)
3. one recorded event per successful consume (no lost or phantom events)
4. recorded history reconciles with the consumed amount

Each `fast-check` **run** is a complete randomized workload: a fresh wallet with a
random start balance plus an array of 1–20 credit/consume operations fired
**concurrently**, so every run fans out into many real concurrent interleavings.
The run count is set by `PROPERTY_NUM_RUNS` — **300 by default** (hundreds of
workloads, ~13s of test body locally) and **1000 in CI** (~29s), so each CI build
genuinely exercises a thousand random workloads. The app boots one Nest instance
on a single SQLite connection (`connection_limit=1`), so runs are effectively
serialized — which is why the counts are bounded rather than "infinite."

If a race ever existed, `fast-check` shrinks the failure to a minimal sequence and
prints it. Run: `npm run test:property` (override with `PROPERTY_NUM_RUNS=1000 npm run test:property`).

## 3. The consistency suite (the classic centerpiece)

`test/e2e/concurrency.e2e.spec.ts` asserts the invariants a read-modify-write
race would violate:

1. **No overspend** — 60 concurrent consumes at a wallet that affords 20 → **exactly 20 succeed**, 40 get 422.
2. **Never negative** — final balance is exactly 0, never below.
3. **Balance == history** — `finalBalance == startBalance − SUM(all consumption events)`.
4. **No lost events** — exactly one event row per successful (201) charge.
5. **Isolation** — concurrent load on two customers spends each to exactly 0, no cross-contamination.

Plus a mixed case: 50 concurrent credits + 50 concurrent consumes reconcile to the cent.

## 4. Idempotency under a retry storm

`test/e2e/idempotency.e2e.spec.ts`: many concurrent requests sharing one
`Idempotency-Key` → charged **exactly once** (one fresh charge, the rest replays),
even when the duplicates race. See the [Idempotency guide](./idempotency.md).

## 5. Chaos: kill a replica mid-load

`scripts/chaos-check.mjs` fires a burst of concurrent charges at the live stack,
then `docker kill`s one of the two backend replicas **mid-flight**. Requests on
the dying instance fail — but the wallet is still exact, because every charge is
one atomic transaction (a half-applied charge is impossible).

Actual output (`npm run chaos`):

```
Replica killed mid-load    : yes
Succeeded (201)            : 266
Insufficient funds (422)   : 0
Failed (crash/connection)  : 34
Final balance              : 7299c
Expected (start - ok*price): 7299c
Never negative             : true
Math consistent            : true
PASS: wallet stayed perfectly consistent despite a replica dying mid-load
```

A server died in the middle of 300 payments, 34 requests failed — and the wallet
was still penny-perfect. (The killed replica is restarted automatically.)

## 6. Runtime metrics: see the machinery work

`GET /api/metrics` exposes per-instance counters so the concurrency control is
**observable**, not just asserted:

```json
{
  "instance": "aee4a38f340b",
  "uptimeSeconds": 170,
  "consume": { "ok": 53, "replayed": 30, "insufficientFunds": 0, "notFound": 0 },
  "db": { "retries": 0, "retriesExhausted": 0 }
}
```

Run `npm run prove` and watch `consume.ok` and `consume.replayed` climb on both
replicas while accounting stays exact. `db.retries` often stays at **0** — that is
the healthy path: SQLite's `busy_timeout` absorbed the lock contention before the
app-level retry safety net had to run. The retry path is still unit-tested and the
counter only rises under extreme sustained contention. Counters are per-process,
so each replica reports its own values (hence the `instance`).

---

## One-command live proofs (against the running Docker stack)

These hit the nginx gateway, so requests are **load-balanced across both backend
replicas** sharing one SQLite file — proving multi-instance safety, not just
single-process correctness.

```bash
npm run prove              # concurrency + idempotency, one command
npm run stress             # concurrency only - hits both replicas via nginx
npm run stress:idempotency # retry storm - duplicates charged once
npm run chaos              # kill a replica mid-load, prove consistency holds
```

Each script exits `0` on pass and prints a summary table. They run in the
[CI pipeline](../../.github/workflows/ci.yml) too: the GitHub green badge means
the full Docker stack booted and every live proof — concurrency, idempotency,
metrics, and chaos — passed.

## What CI runs

The GitHub Actions workflow mirrors the manual proof path:

1. **Backend tests:** `npm test` in `backend/` with `PROPERTY_NUM_RUNS=1000`.
   This runs unit, integration, e2e, race-demo, idempotency, concurrency, and
   property-based fuzz tests. The property test uses a thousand randomized
   concurrent workloads in CI.
2. **Frontend build:** `npm run build` in `frontend/`, so TypeScript and the
   production bundle must compile.
3. **Live Docker proof:** boots the full Compose stack, waits for
   `/api/health`, then runs:
   - `scripts/concurrency-check.mjs`
   - `scripts/idempotency-check.mjs`
   - a `/api/metrics` payload validation
   - `scripts/chaos-check.mjs`

This means CI verifies both the isolated test suite and the actual
two-replica Docker deployment.

## Related ADRs

- [ADR-0008: Proving correctness under concurrency](../decisions/0008-proving-correctness-under-concurrency.md) — the demo / fuzz / chaos / metrics strategy
- [ADR-0001: Atomic guarded UPDATE](../decisions/0001-atomic-guarded-balance-update.md) — the mechanism being proven
- [ADR-0007: Full-jitter retry backoff](../decisions/0007-full-jitter-retry-backoff.md) — what `db.retries` measures

---

[Back to README](../../README.md) | [All guides](./)
