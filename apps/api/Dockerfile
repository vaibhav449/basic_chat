# syntax=docker/dockerfile:1

# REPO ROOT se build karna hai, is folder se nahi:
#   docker build -f apps/api/Dockerfile -t chat-api .
# Context root hona zaroori hai kyunki is app ki dependencies iske folder ke
# bahar, packages/ mein rehti hain.

# ---------------------------------------------------------------------------
# STAGE 1 - base: common neenv, baaki saare stages isko reuse karte hain
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# corepack "packageManager" field padhke exactly wahi pnpm version use karta hai
# jisse lockfile likha gaya tha. Reproducible builds ke liye zaroori.
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# STAGE 2 - prepare: monorepo ko chhantke sirf @chat/api ka hissa nikalo
# ---------------------------------------------------------------------------
# Haan, yahan poora repo COPY ho raha hai - prune ko decide karne ke liye poora
# graph dekhna padta hai. Par ye stage THROWAWAY hai, final image mein nahi
# jata.
#
# Is stage ka cache har change pe tootega, aur wo theek hai: prune 1-2 second
# leta hai. Saari volatility yahan kaid karke, agla (mehnga) install stage
# sirf out/json consume karta hai - jo code badalne pe same rehta hai.
FROM base AS prepare
# Version pin hai taaki kal turbo 3.0 aane se build achanak na toote.
ARG TURBO_VERSION=2.11.7
RUN npm install -g "turbo@${TURBO_VERSION}"
COPY . .
RUN turbo prune @chat/api --docker

# ---------------------------------------------------------------------------
# STAGE 3 - deps: install, ek aise layer mein jo sirf manifest badalne pe toote
# ---------------------------------------------------------------------------
# Sirf out/json aa raha hai: manifests + pruned lockfile, koi source nahi.
# Isi wajah se code badalne pe ye poora mehnga step cache se aata hai.
FROM base AS deps
COPY --from=prepare /app/out/json/ .
# --frozen-lockfile: lockfile aur package.json match na karein to FAIL karo,
# chup-chaap lockfile update karke aage na badho. Prod builds mein zaroori.
#
# --mount=type=cache: layer cache se ALAG cheez hai. Ye ek permanent folder hai
# jo builds ke beech bacha rehta hai. Layer cache MISS hone pe bhi packages
# network se dobara download nahi hote, store se link ho jate hain.
# Iska content final image mein nahi jata.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# STAGE 4 - build: pehle @chat/shared compile hoga, phir @chat/api
# ---------------------------------------------------------------------------
# Dhyan do: "FROM deps", "FROM base" nahi. Isse pichle stage ka poora
# node_modules wirasat mein mil jata hai.
FROM deps AS build
COPY --from=prepare /app/out/full/ .
# Is command mein @chat/shared ka naam KAHIN NAHI hai, par wo pehle build hoga.
# turbo.json ka "dependsOn": ["^build"] aur package.json ka workspace:* milke
# order khud nikaal lete hain. Kal naya package add karo to ye line waisi hi
# rahegi.
RUN pnpm exec turbo run build --filter=@chat/api

# ---------------------------------------------------------------------------
# STAGE 5 - runner: sirf prod dependencies aur compiled output. Yahi ship hoga.
# ---------------------------------------------------------------------------
# Phir "FROM base" - build stage ka sab kuch jaan-boojh ke phenk rahe hain.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=4010

# build stage se node_modules COPY nahi kar rahe, kyunki usme typescript, tsx
# aur turbo bhi hain. Manifests se --prod install karna hi wo sab drop karta
# hai.
#
# DHYAN: --prod root ki devDependencies bhi drop karta hai. To agar kisi package
# ne root se kuch "udhaar" liya tha (Chunk 1 ka leak), wo yahan Cannot find
# module banke phatega.
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# shared pehle: apps/api/node_modules/@chat/shared ek symlink hai jo packages/shared pe
# point karta hai, aur api runtime pe sach mein usko require karta hai (usme
# asli zod schemas hain, sirf types nahi).
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Non-root user. Default root hai, aur app mein koi vulnerability nikle to
# attacker ko container ke andar root mil jata hai - jahan se escape aasan hai.
#
# DHYAN: yahan "chown -R app:nodejs /app" JAAN-BOOJH KE nahi hai. Layers
# copy-on-write hote hain aur ownership badalna bhi modify maana jata hai, to
# chown -R poore /app ko naye layer mein dobara likh deta hai - 16MB extra,
# kyunki node_modules image mein do baar pad jata hai.
#
# Zaroorat bhi nahi hai: app sirf padhta hai, /app mein kuch likhta nahi, aur
# install ki hui files 644/755 hain. Ulta ye zyada SAFE hai - app apni hi
# dependencies modify nahi kar sakta.
RUN addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs app
USER app

# Ye port PUBLISH nahi karta - ye sirf documentation hai. Publishing docker run
# -p ya compose ke ports: se hoti hai.
EXPOSE 4010

# "Running" aur "actually kaam kar raha hai" do alag cheezein hain. Process
# zinda ho par port pe listen na kar paaye to docker ps usko running dikhayega.
# curl ke bajaye node ka built-in fetch, taaki alpine mein curl add na karna pade.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ARRAY form zaroori hai. String form mein PID 1 shell banta hai aur SIGTERM
# node tak nahi pahunchta, to index.ts ka graceful shutdown handler kabhi nahi
# chalta aur sockets beech raaste mein marte hain.
CMD ["node", "apps/api/dist/index.js"]
