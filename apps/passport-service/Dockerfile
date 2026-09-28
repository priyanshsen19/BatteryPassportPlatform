# Build context: repository root (docker build -f apps/passport-service/Dockerfile .)
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/passport-service ./apps/passport-service
RUN pnpm install --frozen-lockfile --filter passport-service...
RUN pnpm --filter passport-service... build \
  && pnpm --filter passport-service deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4002
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4002}/health" > /dev/null || exit 1
CMD ["node", "dist/server.js"]
