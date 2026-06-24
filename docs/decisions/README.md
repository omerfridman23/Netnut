# Architecture Decision Records (ADRs)

Short, dated records of the significant technical decisions in this project: the
context, the options weighed, what was chosen, and the consequences. They make
the *why* behind the code reviewable on its own.

| #    | Decision                                            | Status   |
| ---- | --------------------------------------------------- | -------- |
| 0001 | Atomic guarded UPDATE for wallet consistency        | Accepted |
| 0002 | Ledger events + materialized balance                | Accepted |
| 0003 | SQLite (WAL) with multiple backend instances        | Accepted |
| 0004 | Client-supplied idempotency keys for consume        | Accepted |
| 0005 | Unified wallet ledger (`WalletTransaction`)       | Accepted |
| 0006 | Frontend freshness via React Query (polling/invalidate) | Accepted |
| 0007 | Full-jitter exponential backoff for write retries   | Accepted |
| 0008 | Proving correctness under concurrency (demo/fuzz/chaos/metrics) | Accepted |

## System invariant

Every decision below serves one invariant the system must never break:

> For every customer, at all times: `walletBalance == SUM(consumption credits − debits)` **and** `walletBalance >= 0`.

- **Enforced by:** an atomic guarded `UPDATE ... WHERE balance >= cost` inside a transaction (ADR-0001) that also writes the ledger event (ADR-0002).
- **Verified by:** the concurrency + idempotency test suites and the live `scripts/*-check.mjs` proofs.
