# ---- Builder ----
FROM node:24-alpine AS builder
WORKDIR /app

# Install deps first (better layer cache)
COPY package.json package-lock.json* .npmrc* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# Copy sources and build
COPY tsconfig.json ./
COPY src ./src
COPY types ./types
RUN npm run build

# ---- Runner ----
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S app && adduser -S app -G app
USER app

# Expect OPENAI_API_KEY at runtime
ENV OPENAI_MODEL=gpt-4o-mini

ENTRYPOINT ["node", "dist/index.js"]
# usage example:
# docker run --rm -e OPENAI_API_KEY=sk-... -v $(pwd):/data IMAGE --input /data/bookmarks.xbel --out /data/result.xbel --folders "Work,Personal"


