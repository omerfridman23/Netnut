# Local development (without Docker)

```bash
# Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev        # create + apply migration
npx prisma db seed            # seed data
npm run start:dev             # http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api -> :3000)
```

---

[Back to README](../../README.md) | [All guides](./)
