# Stage 1: Base image with Bun
FROM oven/bun:1-slim AS base
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS install
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Stage 3: Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 4: Production image
FROM base AS production

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy production dependencies
COPY --from=install /app/node_modules ./node_modules

# Copy built files and configs
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .
COPY --from=build /app/.env* ./

# Set environment
ENV NODE_ENV=production

# Expose the webhook port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
USER bun
CMD ["bun", "run", "dist/index.js"]
