# Nexternel API — build from repo root

FROM node:22.23.3-alpine AS builder

WORKDIR /app

COPY packages/domain ./packages/domain
COPY packages/plugin-sdk ./packages/plugin-sdk
COPY apps/api ./apps/api

WORKDIR /app/packages/domain
RUN npm install && npm run build

WORKDIR /app/packages/plugin-sdk
RUN npm install && npm run build

WORKDIR /app/apps/api
RUN npm install && npm run build

FROM node:22.23.3-alpine AS runner

COPY --from=influxdb:2.7.12-alpine /usr/local/bin/influx /usr/local/bin/influx
# mosquitto_passwd from Alpine's package, with the libraries it needs (copying the bare binary
# from eclipse-mosquitto broke once that image started linking libcjson).
RUN apk add --no-cache mosquitto
COPY --from=docker:27.5.1-cli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

COPY --from=builder /app/packages/domain ./packages/domain
COPY --from=builder /app/packages/plugin-sdk ./packages/plugin-sdk
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/index.js"]
