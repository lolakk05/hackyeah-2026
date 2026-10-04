# Spacer.io as a web app.
#
#   docker compose up --build        → http://localhost:8080
#   (or)  docker build -t spacerio-web . && docker run -p 8080:80 spacerio-web
#
# Stage 1 builds the Expo app for the web (static files); stage 2 serves them
# with nginx. Backend addresses are baked in at build time: they come from
# `.env` and can be overridden with --build-arg EXPO_PUBLIC_API_URL=... etc.

# ─── 1. Build ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Dependencies first (cached while only the source changes).
# No lockfile on purpose: one made on a Mac lacks the Linux build tools.
COPY package.json ./
RUN npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps

COPY . .

# Optional overrides of the addresses in .env (empty = use .env).
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_AUTH_API_URL
ARG EXPO_PUBLIC_ACCOUNT_API_URL
ARG EXPO_PUBLIC_AI_GUIDE_URL

RUN for v in EXPO_PUBLIC_API_URL EXPO_PUBLIC_AUTH_API_URL EXPO_PUBLIC_ACCOUNT_API_URL EXPO_PUBLIC_AI_GUIDE_URL; do \
      eval "val=\${$v}"; if [ -z "$val" ]; then unset "$v"; fi; \
    done \
 && CI=1 npx expo export --platform web --output-dir dist --clear

# ─── 2. Serve ────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
