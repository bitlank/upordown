FROM node:20-alpine AS builder

WORKDIR /app/backend
COPY backend/package*.json .
RUN npm install

WORKDIR /app
COPY backend backend
COPY shared shared

WORKDIR /app/backend
RUN npm run build

FROM node:20-alpine

WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules node_modules
COPY --from=builder /app/backend/dist dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
