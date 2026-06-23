# ADR-0008: Proving correctness under concurrency

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

The system's headline guarantee is **provably correct wallet accounting under
concurrent, multi-instance load** (ADR-0001). A guarantee is only as strong as
the evidence behind it. The example-based concurrency and idempotency suites
already prove specific scenarios; we wanted evidence that is broader, more
adversarial, and easy for a reviewer to see for themselves.

## Decision

Add four complementary layers of proof and a way to observe the machinery:

1. **Counter-example demo** (`test/e2e/race-demo.e2e.spec.ts`)
   Runs the *naive* read-modify-write implementation and the *correct* atomic
   guarded UPDATE against the identical concurrent workload. The naive path
   visibly loses updates (money silently retained); the atomic path is exact.
   This demonstrates *why* the design is necessary, not just that it works.

2. **Property-based fuzz** (`test/property/wallet.property.spec.ts`, `fast-check`)
   Generates many random mixes of credits and consumptions, fires each mix
   concurrently, and asserts the invariant for **every** generated case:
   `finalBalance == start + Σcredits − Σconsumes`, never negative, one event per
   successful consume, and history reconciles. A regression shrinks to a minimal
   failing sequence automatically. The run count is set by `PROPERTY_NUM_RUNS`:
   **300 by default** (hundreds of random concurrent workloads, kept fast for
   local `npm test`) and **1000 in CI**, so each build genuinely exercises a
   thousand randomized workloads. Each run is itself a fresh wallet plus 1–20
   operations fired concurrently, fanning out into many interleavings.

3. **Chaos / fault injection** (`scripts/chaos-check.mjs`)
   Kills one backend replica mid-load against the live Docker stack and proves
   the wallet is still exactly consistent. A charge is one atomic transaction, so
   an instance dying mid-flight can never leave a half-applied charge.

4. **Runtime metrics** (`GET /api/metrics`)
   Exposes per-instance counters — consume outcomes and, crucially, how often
   SQLite write contention forced a `dbRetries` backoff and how often retries
   were exhausted. This makes the concurrency control *observable* under load.

## Consequences

- Correctness is evidenced from four angles: a demonstrated counter-example,
  randomized adversarial input, infrastructure failure, and live observability.
- `fast-check` is added as a dev dependency.
- The race demo and property suites run in CI with the rest of the tests; the
  chaos script is run manually (or in the e2e stack job) because it manipulates
  running containers.
- Metrics are per-process: with multiple replicas each reports its own numbers,
  so the response includes the instance hostname.
- Trade-off: the property suite adds runtime to the test run (bounded via
  `PROPERTY_NUM_RUNS` — ~13s for the default 300 locally, ~29s for 1000 in CI);
  we accept it for the dramatically wider coverage.
