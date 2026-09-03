FROM node:24.19.0-alpine

RUN apk add --no-cache git && addgroup -g 10001 mergepilot && adduser -D -u 10001 -G mergepilot mergepilot
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/repo-mcp/package.json apps/repo-mcp/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/policy/package.json packages/policy/package.json
RUN corepack enable && pnpm install --frozen-lockfile

COPY apps/repo-mcp apps/repo-mcp
COPY packages/contracts packages/contracts
COPY packages/policy packages/policy
COPY fixtures fixtures/visible
COPY deploy/runner-entrypoint.ts deploy/runner-entrypoint.ts

USER 10001:10001
ENTRYPOINT ["pnpm", "exec", "tsx", "deploy/runner-entrypoint.ts"]
