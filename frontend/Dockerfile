FROM node:20-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package*.json .
RUN npm install

WORKDIR /app
COPY frontend frontend
COPY backend/src/shared backend/src/shared

WORKDIR /app/frontend
RUN npm run build

FROM nginx:stable-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
