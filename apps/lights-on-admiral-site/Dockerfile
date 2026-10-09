FROM node:22.14.0-alpine AS build

WORKDIR /app
COPY package.json ./
COPY scripts ./scripts
COPY public ./public
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health.json >/dev/null || exit 1
