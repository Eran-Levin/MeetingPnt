# Build context is the REPO ROOT, not backend/ — the backend imports @meetingpnt/shared through
# the npm workspace, so the lockfile and shared/ have to be inside the context.
#   docker build -f backend/Dockerfile .
#
# Debian (not Alpine) on purpose: argon2 ships glibc prebuilds and the Prisma query engine wants
# OpenSSL 3. On musl both fall back to compiling from source, or fail outright.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# shared/ is copied *before* the install because the root postinstall builds it — without the
# sources present the install itself fails. Only backend + shared are installed; pulling in the
# mobile workspace would drag the whole Expo toolchain into an image that never builds the app.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared ./shared
COPY backend/package.json ./backend/
RUN npm ci --include-workspace-root -w @meetingpnt/shared -w @meetingpnt/backend

COPY backend ./backend

RUN npm run prisma:generate -w @meetingpnt/backend \
  && npm run build -w @meetingpnt/backend

WORKDIR /app/backend

ENV NODE_ENV=production
# The host injects its own PORT; this is only the fallback.
ENV PORT=4000
EXPOSE 4000

# Migrations run on boot rather than as a separate deploy step: free tiers give you one process,
# and `migrate deploy` is a no-op once the schema is current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
