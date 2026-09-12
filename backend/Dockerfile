# ---- Build stage -------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage -----------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Dev dependencies are kept on purpose: the container runs `prisma db push`
# on boot and `prisma db seed` (which uses tsx) on demand, and both the
# Prisma CLI and tsx live in devDependencies.
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/server.js"]
