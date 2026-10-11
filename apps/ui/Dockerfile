# Nexternel UI — build from repo root
FROM node:22.23.3-alpine AS builder
WORKDIR /app

COPY packages/domain ./packages/domain
COPY packages/plugin-sdk ./packages/plugin-sdk
COPY apps/ui ./apps/ui

WORKDIR /app/packages/domain
RUN npm install && npm run build

WORKDIR /app/packages/plugin-sdk
RUN npm install && npm run build

WORKDIR /app/apps/ui
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm install && npm run build

FROM nginx:1.27.5-alpine AS runner
COPY apps/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
