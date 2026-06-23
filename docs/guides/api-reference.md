# API reference

All routes are under `/api`. Money fields are always integer **cents**.

| Method | Path | Description | Codes |
| --- | --- | --- | --- |
| GET | `/api/health` | Liveness + DB check + replica hostname | 200 / 503 |
| GET | `/api/metrics` | Per-replica counters (consume outcomes, DB retry stats) | 200 |
| GET | `/api/products` | List products | 200 |
| GET | `/api/customers?limit=&offset=` | List customers (offset pagination) | 200 |
| GET | `/api/customers/:id` | Customer details | 200 / 404 |
| POST | `/api/customers/:id/credit` | Top up wallet `{ amountCents }` | 200 / 400 / 404 |
| POST | `/api/consumption` | Consume `{ customerId, productId, quantity }` | 201 / 400 / 404 / 422 |
| GET | `/api/customers/:id/consumption?limit=&offset=` | Consumption history (newest first) | 200 / 404 |

Errors share a consistent shape:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "...", "statusCode": 422 } }
```

Paginated lists return `{ "data": [...], "total": 120, "offset": 0, "limit": 20 }`.

---

[Back to README](../../README.md) | [All guides](./)
