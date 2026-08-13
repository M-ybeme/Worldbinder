# syntax=docker/dockerfile:1

# Railway: set this service's Dockerfile Path to apps/api/Dockerfile and
# leave Root Directory empty — the build context must be the repo root, not
# apps/api, so pnpm can resolve every internal "workspace:*" dependency on
# packages/contracts, packages/validation, packages/config (ADR-0015's
# single shared workspace, not isolated per-app installs). This sidesteps
# Railpack's install-phase package-manager auto-detection entirely, which is
# what was invoking npm instead of pnpm against this repo's workspace
# protocol dependencies.

FROM node:24-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@worldbinder/api...

WORKDIR /app/apps/api
ENV NODE_ENV=production

CMD ["node", "dist/src/main.js"]
