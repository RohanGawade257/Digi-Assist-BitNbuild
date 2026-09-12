FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS build
RUN npm install --global pnpm@10.30.3
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=guide-pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY packages ./packages
COPY apps ./apps
COPY config ./config
RUN pnpm --filter @guide/contracts build
ARG APP_FILTER
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
RUN pnpm --filter "${APP_FILTER}" build
ENV NODE_ENV=production
ENV APP_FILTER=${APP_FILTER}
USER node
CMD ["sh", "-c", "exec pnpm --filter \"$APP_FILTER\" start"]
