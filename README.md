# basic-chat

A deliberately small real-time chat app, used as a vehicle for learning
monorepo tooling, Docker-based deployment and CI/CD.

## Layout

```
basic_chat/
├── apps/
│   ├── api/          Express + Socket.IO server (TypeScript -> dist/)
│   └── web/          React + Vite single-page app (-> dist/ static assets)
├── packages/
│   └── shared/       the wire contract: socket event types + zod schemas
├── scripts/
│   └── smoke.mjs     end-to-end check, run locally and after every deploy
├── pnpm-workspace.yaml   which folders are packages
└── turbo.json            task graph + cache config
```

`packages/shared` is the reason this is a monorepo: both apps import the same
event names and schemas, so renaming an event fails typecheck on the client
and the server in the same run.

## Local development

```bash
pnpm install
pnpm dev            # api on :4010, web on :5173 (proxying to the api)
```

The Vite dev server proxies `/api` and `/socket.io` to the API, so the browser
only ever talks to one origin. Production works the same way via a reverse
proxy, which is why no API hostname is ever baked into the bundle.

## Useful commands

```bash
pnpm build          # build every package in dependency order (cached)
pnpm typecheck      # typecheck the whole workspace
pnpm smoke <url>    # end-to-end check against a running stack
```
