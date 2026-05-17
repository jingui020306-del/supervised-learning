# Stage 1: Build TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.release.json ./
COPY backend/src ./src
RUN npx tsc -p tsconfig.release.json && cp -r src/views dist/

# Stage 2: Production
FROM node:22-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY release/views/partials ./dist/views/partials
EXPOSE 3001
RUN mkdir -p /data
CMD npx prisma db push --skip-generate --accept-data-loss 2>/dev/null; node dist/index.js
