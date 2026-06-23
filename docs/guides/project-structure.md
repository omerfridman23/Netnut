# Project structure

```
backend/
  src/
    main.ts                      app bootstrap (global prefix, validation, filters)
    app.module.ts
    config/env.ts                validated environment config
    prisma/                      PrismaService (WAL PRAGMAs) + global module
    common/                      errors, exception filter, logging, pagination, retry, metrics
    common/metrics/              in-memory counters + GET /api/metrics
    products/                    controller / service / repository / types / dto
    customers/                   controller / service / repository / types / dto
    consumption/                 controller / service / repository / types / dto  <- atomic wallet + idempotency
    health/
  prisma/schema.prisma           data model + indexes
  prisma/seed.ts                 seed scenarios
  test/
    unit/                        retry helper (no I/O)
    integration/                 service + repository against real SQLite
    e2e/                         HTTP: concurrency, idempotency, race-demo, api contract
    property/                    property-based fuzz (random concurrent workloads)
    helpers/                     boots a real Nest app on an isolated SQLite db
frontend/
  src/
    api/                         typed client + React Query hooks (idempotency key per click)
    components/                  Layout, BalanceChip, ConsumeProductDialog, CreditWalletForm, StatCard, PageHeader, SpendByProduct
    pages/                       CustomersPage + CustomerDetailPage (JSX) with their logic in use*Page.ts hooks
    utils/                       money (cents formatting + balance status), avatar
gateway/nginx.conf               load balancer across backend replicas
docker-compose.yml               migrate + 2 backends + gateway + frontend
scripts/
  concurrency-check.mjs          live multi-instance concurrency proof
  idempotency-check.mjs          live retry-storm idempotency proof
  chaos-check.mjs                live chaos proof: kill a replica mid-load
docs/
  guides/                        explanatory guides (this folder)
  decisions/                     Architecture Decision Records (ADRs)
    0001-atomic-guarded-balance-update.md
    0002-ledger-events-and-materialized-balance.md
    0003-sqlite-wal-multi-instance.md
    0004-idempotency-keys.md
    0005-money-as-integer-cents.md
    0006-frontend-data-freshness.md
    0007-full-jitter-retry-backoff.md
    0008-proving-correctness-under-concurrency.md
.github/workflows/ci.yml         CI: tests + full Docker stack proof (concurrency, idempotency, metrics, chaos)
```

---

[Back to README](../../README.md) | [All guides](./)
