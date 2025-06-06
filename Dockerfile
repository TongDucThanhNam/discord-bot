# Stage 1: Base image with Bun
FROM oven/bun:1-slim AS base
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS install
COPY package.json bun.lock* ./
RUN bun install

# Stage 3: Build the application
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 4: Production image
FROM base AS production

# Copy production dependencies and built files
COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .
COPY --from=build /app/.env* ./

# Set environment
ENV NODE_ENV=production

# Expose the webhook port
EXPOSE 3000

# Run the application
USER bun
CMD ["bun", "run", "dist/index.js"]