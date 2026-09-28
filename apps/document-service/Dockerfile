# Build context: repository root (docker build -f apps/document-service/Dockerfile .)
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/document-service ./apps/document-service
RUN pnpm install --frozen-lockfile --filter document-service...
RUN pnpm --filter document-service... build \
  && pnpm --filter document-service deploy --prod --legacy /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4003
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4003}/health" > /dev/null || exit 1
CMD ["node", "dist/server.js"]
