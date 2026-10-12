# Nexternel plugin container: no dependencies, only Node.
FROM node:22.23.3-alpine

WORKDIR /app
COPY apps/plugin-host/host.mjs apps/plugin-host/runner.mjs ./

ENV NODE_ENV=production
# Runs as root only to start each plugin under its own user id.
CMD ["node", "/app/host.mjs"]
