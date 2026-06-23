# ADR-0003: SQLite (WAL) with multiple backend instances

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

The stack runs two backend replicas sharing one SQLite database file (proving the
multi-instance requirement). SQLite is a single-writer engine, so concurrent
writes from both replicas must be coordinated safely.

## Decision

- Enable **WAL** (`journal_mode = WAL`) so readers never block the writer and the
  writer never blocks readers — good for a polling dashboard.
- Set **`busy_timeout`** so a writer that finds the lock held waits and retries
  internally instead of immediately failing with `SQLITE_BUSY`.
- Add an application-level **retry with backoff** for the rare residual
  `SQLITE_BUSY` / write-conflict, which is safe because each write is one atomic
  transaction (ADR-0001).
- Pin `connection_limit=1` per process so the per-connection PRAGMAs reliably
  govern all access.

## Consequences

- Writes from both instances serialize at the database and stay correct.
- SQLite's serialization comfortably handles "thousands per minute"; it is **not**
  intended for very high write throughput or a single hot row at thousands/sec.
- Migration path: move to PostgreSQL and either keep the same atomic guarded
  UPDATE or use `SELECT ... FOR UPDATE` / an optimistic version column, plus a
  connection pool. Hot-wallet contention would be addressed by batching or
  aggregating consumption events.
