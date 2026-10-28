# MAYA API image. Build from the repo root:
#   docker build -f deploy/Dockerfile .
#
# Debian slim, not Alpine: the API depends on argon2, a native module that
# ships glibc prebuilds.
FROM node:24-slim

ENV NODE_ENV=production

# corepack needs root to place its shims; everything after runs as "node".
RUN corepack enable

# /app is created owned by node so the install and build output are readable
# (and writable by the build) without a recursive chown layer.
RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node . .

# devDependencies are required to compile, so install with NODE_ENV unset for
# this step only.
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter @appstore/api... \
 && pnpm --filter @appstore/api... build

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
