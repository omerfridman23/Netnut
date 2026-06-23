# ADR-0007: Full-jitter exponential backoff for write retries

- **Status:** Accepted
- **Date:** 2026-06-23

## Context

SQLite allows only one writer at a time. The atomic consume transaction
(see ADR-0001) is wrapped in a retry helper (ADR-0003) because, under high
concurrency, even with `busy_timeout` set, writers can still surface a transient
`SQLITE_BUSY` / "database is locked" error. These are safe to retry: the
transaction is all-or-nothing, so a failed attempt leaves no partial state.

The retry helper must decide *how long to wait* between attempts. The original
implementation used exponential backoff with a small additive jitter:

```ts
delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
```

The problem: the deterministic term (`base * 2^attempt`) dominates, so a group
of writers that collide will all wait *almost* the same amount and retry at
*almost* the same instant — only differing by a few milliseconds of noise. They
collide again, repeatedly. This is the classic "thundering herd" retry pattern.

Two further weaknesses: the exponential term was uncapped (raising the retry
count could push a single wait into multiple seconds), and the tuning constants
were hardcoded.

## Decision

Adopt **full jitter** exponential backoff, as described in the AWS Architecture
Blog ("Exponential Backoff And Jitter"). Each retry waits a uniformly random
delay across the *entire* backoff window, and the window is capped:

```ts
const ceiling = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
await sleep(Math.random() * ceiling);
```

All backoff parameters are centralized in `config/env.ts` and overridable via
environment variables:

- `DB_RETRIES` (default 5)
- `DB_RETRY_BASE_DELAY_MS` (default 25)
- `DB_RETRY_MAX_DELAY_MS` (default 1000)

Only genuinely transient lock errors are retried (`SQLITE_BUSY`, "database is
locked", Prisma `P2034`); any other error throws immediately.

## Consequences

- Competing writers are scattered across the whole backoff window, dramatically
  reducing repeat collisions on the write lock under load.
- The delay cap bounds worst-case latency even if the retry count is increased.
- Backoff behavior is now tunable per environment without code changes.
- Trade-off: full jitter means an individual retry *may* wait very little (close
  to 0 ms). That is intentional and safe here — the goal is aggregate spread
  across many writers, not a guaranteed minimum wait for any single one.
