# Giai đoạn 1: Sử dụng image cơ sở Bun
FROM oven/bun:1-slim AS base
WORKDIR /app

# Thiết lập môi trường production
ENV NODE_ENV=production

# Tạo user không có quyền root để tăng tính bảo mật
RUN addgroup --system --gid 1001 bunuser && \
    adduser --system --uid 1001 bunuser

# Giai đoạn 2: Cài đặt các phụ thuộc
FROM base AS deps
# Chỉ copy các file cần thiết để cài đặt phụ thuộc
COPY --chown=bunuser:bunuser package.json bun.lock* ./
# Cài đặt các phụ thuộc (bao gồm cả devDependencies)
RUN bun install --frozen-lockfile --production=false

# Giai đoạn 3: Build ứng dụng
FROM deps AS builder
# Copy toàn bộ mã nguồn
COPY --chown=bunuser:bunuser . .
# Thực hiện build ứng dụng
RUN bun run build

# Giai đoạn 4: Tạo image production cuối cùng
FROM base AS runner
# Chuyển sang sử dụng user không có quyền root
USER bunuser

# Chỉ copy các file cần thiết cho môi trường production
COPY --chown=bunuser:bunuser --from=deps /app/node_modules ./node_modules
COPY --chown=bunuser:bunuser --from=builder /app/dist ./dist
COPY --chown=bunuser:bunuser package.json .
COPY --chown=bunuser:bunuser --from=builder /app/.env* ./

# Tạo một HTTP server đơn giản để kiểm tra tình trạng hoạt động
RUN echo 'const http = require("http"); \
const server = http.createServer((req, res) => { \
  res.writeHead(200); \
  res.end("OK"); \
}); \
server.listen(8080);' > /app/health.js

# Mở cổng cho webhook
EXPOSE 3000

# Chạy cả health check và ứng dụng chính
CMD bun run health.js & bun run dist/index.js