# syntax=docker/dockerfile:1

# Railway: set this service's Dockerfile Path to apps/worker/Dockerfile and
# leave Root Directory empty — same reasoning as apps/api/Dockerfile (the
# build context must be the repo root for pnpm's workspace to resolve).

FROM node:24-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@worldbinder/worker...

WORKDIR /app/apps/worker
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
