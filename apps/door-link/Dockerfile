# Nexternel Anywhere home link. No dependencies, only Node.
FROM node:22.23.3-alpine
WORKDIR /app
COPY apps/door-link/link.mjs ./
# The Nexternel version it reports to the door
COPY apps/ui/src/version.ts ./
CMD ["node", "/app/link.mjs"]
