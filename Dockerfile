# syntax=docker/dockerfile:1

# ── Stage 1 : build ────────────────────────────────────────────────────────
# Installe toutes les dépendances (dont devDependencies : Nest CLI, TS) et
# compile l'app vers dist/.
FROM node:22-slim AS builder

# openssl : requis par Prisma lors de `prisma generate`
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pas de package-lock.json -> npm install.
# On retire le hook `prepare` (husky) inutile en conteneur avant l'install.
COPY package*.json ./
RUN npm pkg delete scripts.prepare && npm install

COPY . .
# `npm run build` = prisma generate + nest build -> dist/
RUN npm run build

# ── Stage 2 : runtime ──────────────────────────────────────────────────────
# Image finale légère : uniquement les dépendances de prod (+ la CLI prisma,
# déplacée dans dependencies, pour `migrate deploy`).
FROM node:22-slim AS runner

ENV NODE_ENV=production

# ffmpeg : traitement média (fluent-ffmpeg) — openssl : moteur Prisma au runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm pkg delete scripts.prepare && npm install --omit=dev

# Client Prisma généré + app compilée + schéma/migrations
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Railway injecte PORT ; l'app écoute sur process.env.PORT (fallback 4000).
EXPOSE 4000

# Applique les migrations en attente puis lance l'app compilée.
# nest compile aussi utils/ et prisma/, donc l'entrypoint est sous dist/src/.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
