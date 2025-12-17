FROM node:20-alpine AS builder

WORKDIR /app/backend
COPY backend/package*.json .
RUN npm install

WORKDIR /app
COPY backend backend

WORKDIR /app/backend
RUN npm run build

FROM node:20-alpine

WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules node_modules
COPY --from=builder /app/backend/dist dist

RUN chown -R node:node /app/backend
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
