FROM node:24-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts ./
COPY apps/api/package.json apps/api/package.json
COPY apps/runner/package.json apps/runner/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/policy/package.json packages/policy/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json
RUN pnpm install --frozen-lockfile --prod=false
COPY apps/api apps/api
COPY apps/runner apps/runner
COPY packages/contracts packages/contracts
COPY packages/policy packages/policy
COPY packages/test-fixtures packages/test-fixtures
COPY evaluation/reports evaluation/reports
EXPOSE 8787
CMD ["pnpm", "tsx", "apps/api/src/main.ts"]
