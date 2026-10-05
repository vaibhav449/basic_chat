# syntax=docker/dockerfile:1

# REPO ROOT se build karo:
#   docker build -f apps/web/Dockerfile -t chat-web .

# ---------------------------------------------------------------------------
# Stages 1-4 API jaise HI hain (base / prepare / deps / build). Bas prune ka
# target aur build ka filter badla hai. Asli farak stage 5 mein hai.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS prepare
ARG TURBO_VERSION=2.11.7
RUN npm install -g "turbo@${TURBO_VERSION}"
COPY . .
RUN turbo prune @chat/web --docker

FROM base AS deps
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY --from=prepare /app/out/full/ .
# Jaan-boojh ke koi build arg aur koi VITE_* env var nahi hai. Is bundle mein
# kuch bhi environment-specific bake nahi hota, isliye YAHI EK IMAGE kisi bhi
# environment pe deploy ho sakta hai. Dekho apps/web/src/socket.ts.
RUN pnpm exec turbo run build --filter=@chat/web

# ---------------------------------------------------------------------------
# STAGE 5 - runner: Node BILKUL nahi. Sirf static files + reverse proxy.
# ---------------------------------------------------------------------------
# API ka runner Node chalata hai kyunki wo ek chalti hui process hai. Web ka
# output sirf HTML/CSS/JS files hain - unko serve karne ke liye Node ki koi
# zaroorat nahi, to final image mein Node hi nahi daal rahe.
FROM nginx:1.29-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
