# Idempotency

With thousands of events per minute and network retries, a "consume" request can arrive more than once. Without protection each duplicate is a second charge.

## How it works

We accept an optional **`Idempotency-Key` HTTP header** (Stripe-style) on `POST /api/consumption`. The key is stored on the event under a **UNIQUE constraint**:

| Scenario | Outcome |
|---|---|
| First request | Charge applied, event stored, `replayed: false` |
| Retry with same key (sequential) | Original event returned, wallet untouched, `replayed: true` |
| Concurrent duplicates (same key racing) | The loser's balance decrement is **rolled back** inside the transaction; it replays the winner's stored event. Charged **exactly once**. |
| Different key | Treated as a new, independent charge |

The key is nullable - requests without a key never collide (`NULL != NULL` in SQLite).

## What makes this "real" idempotency

A replay returns the **original result** - the same event ID and balance reading - rather than just an error, matching how Stripe behaves. The frontend generates a `crypto.randomUUID()` per submit click, so a double-click or network retry of the same action never double-charges. For why this approach was chosen over the alternatives, see [ADR-0004](../decisions/0004-idempotency-keys.md).

```
POST /api/consumption
Idempotency-Key: a1b2-c3d4-...

{
  "event": { "id": "xyz", "totalCost": 500, ... },
  "walletBalance": 4500,
  "replayed": false     <- first time: fresh charge
}

# Same request again (retry):
{
  "event": { "id": "xyz", ... },  <- same event ID
  "walletBalance": 4500,
  "replayed": true                <- wallet NOT charged again
}
```

## Related ADRs

- [ADR-0004: Client-supplied idempotency keys for consume](../decisions/0004-idempotency-keys.md)

---

[Back to README](../../README.md) | [All guides](./)
