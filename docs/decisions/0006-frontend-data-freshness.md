# ADR-0006: Frontend freshness via React Query

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

Balances and history change constantly as consumption is recorded (potentially
from other instances/clients). The dashboard must show reasonably fresh data and
stay usable as the dataset grows.

## Decision

Use **TanStack React Query** for server state, with freshness from two
complementary mechanisms:

1. **Invalidate on mutation** — after a consume/credit succeeds we invalidate the
   affected queries (`customer`, that customer's `history`, and the `customers`
   list) so the UI reflects the user's own action immediately.
2. **Background polling** — the customer list, customer detail, and history
   queries set `refetchInterval` (10s, see `POLL_INTERVAL_MS`) so changes made by
   **other users or other backend instances** appear without a manual refresh.
   React Query automatically pauses polling while the browser tab is hidden.

Supporting choices:

- Lists and history use **paginated reads** (`limit`/`offset`), so the client
  never fetches the whole table — the dashboard stays usable as data grows.
- Products are cached with a longer `staleTime` and are **not** polled, since
  they rarely change.

## Consequences

- Freshness without WebSocket/SSE infrastructure — appropriate for the time box.
  The UI updates instantly on your own actions and within ~10s for external ones.
- Pagination keeps render and payload sizes bounded as data grows.
- Trade-off: polling is near-real-time, not truly push-based, and adds periodic
  background requests. For instant cross-client updates at higher event rates,
  the next step is SSE or WebSockets streaming balance changes; the polling
  interval is a single tunable constant in the meantime.
