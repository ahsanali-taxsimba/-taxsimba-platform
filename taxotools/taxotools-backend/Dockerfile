FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV BACKEND_PORT=3200
ENV CRAWL_DELAY_MS=500
ENV MAX_PAGES_PER_DOMAIN=200
ENV CONTINUOUS_LOOP_SLEEP_MS=90000
ENV CONTINUOUS_FIRM_BATCH=5
ENV USER_AGENT="TaxoToolsBot/1.0 (+https://taxotools.com)"

EXPOSE 3200

# Single process: API + never-stop crawler (auto-restarts children)
CMD ["node", "src/cron/startAlwaysOn.js"]
