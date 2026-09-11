# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install -f

# Copy rest of the code to container
COPY . .

# Remove old Next.js build and ensure .env.production is used
RUN rm -rf .next && cp .env.production .env

# Build fresh Next.js app
RUN npm run build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy standalone build outputs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env ./.env

EXPOSE 3000

# Next.js telemetry disable
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node", "server.js"]


