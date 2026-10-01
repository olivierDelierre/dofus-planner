# syntax=docker/dockerfile:1

# ---- Dépendances ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Exécution ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Guides versionnés dans le dépôt, copiés dans le volume au démarrage s'ils n'y sont pas.
COPY --from=build --chown=node:node /app/data/guides ./seed/guides

RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/auth/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "mkdir -p /data/guides && cp -rn /app/seed/guides/. /data/guides/ 2>/dev/null; exec node server.js"]
