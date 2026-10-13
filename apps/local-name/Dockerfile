# Answers nexternel.local on the home network. No dependencies, only Node.
FROM node:22.23.3-alpine
WORKDIR /app
COPY apps/local-name/responder.mjs ./
USER node
CMD ["node", "/app/responder.mjs"]
