# syntax=docker/dockerfile:1

# Railway: set this service's Dockerfile Path to apps/web/Dockerfile and
# leave Root Directory empty — build context must be the repo root, same
# reasoning as apps/api and apps/worker's Dockerfiles.
#
# Two stages: build the static SPA with the full pnpm workspace available,
# then serve only the built output with Caddy (docs.railway.com's own
# documented approach for SPAs — no Node process needed at runtime).
# VITE_API_URL/VITE_SENTRY_DSN must be set as build-time Variables in
# Railway (not just runtime ones) since Vite bakes them into the bundle at
# build time, not read at runtime.

FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

ARG VITE_API_URL
ARG VITE_SENTRY_DSN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN pnpm turbo build --filter=@worldbinder/web

FROM caddy:2-alpine

COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
