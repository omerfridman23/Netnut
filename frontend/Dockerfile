# ---- Builder: produce the static SPA bundle ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# API base is relative ("/api"); nginx proxies it to the gateway at runtime.
RUN npm run build

# ---- Runner: serve static files with nginx ----
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
