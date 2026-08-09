# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Skip husky in container builds (no .git); allow esbuild/msw postinstall scripts.
ENV HUSKY=0

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy source and build
COPY . .
ARG VITE_API_BASE_URL=""
ARG VITE_WS_BASE_URL=""
ARG VITE_MOCK_API="false"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL
ENV VITE_MOCK_API=$VITE_MOCK_API

RUN pnpm build

# ─── Stage 2: Serve (Angie — nginx-compatible, matches gw chart image) ─────
FROM docker.angie.software/angie:1.12.1-alpine AS serve

# Remove default site config shipped with the image
RUN rm -f /etc/angie/http.d/default.conf

COPY angie.conf /etc/angie/http.d/default.conf
COPY --from=build /app/dist /usr/share/angie/html

# Run as non-root (Angie user in the official image)
RUN chown -R angie:angie /usr/share/angie/html && \
    chown -R angie:angie /var/cache/angie && \
    chown -R angie:angie /var/log/angie && \
    mkdir -p /run/angie && \
    chown angie:angie /run/angie

USER angie

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["angie", "-g", "daemon off;"]
