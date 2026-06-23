# Architecture

```text
Browser
   |  opens dashboard
   v
frontend  (nginx, serves the React app)
   |  forwards /api calls
   v
gateway   (nginx load balancer)
   |  splits load across replicas
   +---------------------+
   v                     v
backend #1           backend #2     (NestJS API)
   |                     |
   +----------+----------+   read / write
              v
        SQLite file  (shared volume)
              ^
              :  creates tables + seed once, then exits
        migrate + seed  (one-shot, runs before the backends)
```

**How to read this:** your browser only ever talks to the `frontend`. The frontend forwards API calls to the `gateway`, which spreads them across **two identical backend replicas**. Both replicas read and write the **same** SQLite file, which is why concurrency safety matters. The `migrate` box runs once at the very start to create the tables and seed data, then exits.

---

[Back to README](../../README.md) | [All guides](./)
