# Answers nexternel.local on the home network and runs the home network search. No dependencies, only Node.
FROM node:22.23.3-alpine
WORKDIR /app
COPY apps/local-name/responder.mjs apps/local-name/dns.mjs apps/local-name/network-search.mjs ./
# The search answers the Nexternel server through a socket file in this folder (a shared volume).
RUN mkdir -p /run/home-network && chown node:node /run/home-network
USER node
CMD ["node", "/app/responder.mjs"]
