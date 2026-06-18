FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json

RUN npm ci

COPY . .

ARG API_URL=https://api-production-945c0.up.railway.app
ARG NEXT_PUBLIC_APP_URL=https://web-production-4b55f8.up.railway.app
ENV API_URL=$API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run db:generate --workspace=packages/db \
  && npm run build

ENV NODE_ENV=production

EXPOSE 3000 3001

CMD ["sh", "-c", "case \"$SERVICE_ROLE\" in web) exec npm run start:web ;; api) npm run db:migrate:prod && exec npm run start:api ;; worker) exec npm run start:worker ;; *) echo \"Unknown SERVICE_ROLE: $SERVICE_ROLE\" >&2; exit 1 ;; esac"]
