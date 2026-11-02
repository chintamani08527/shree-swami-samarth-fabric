# Multi-stage production Dockerfile for Shree Swami Samarth Fabric Attendance Management System
# Base Node.js image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root, server, and client package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Generate Prisma Client & Build TypeScript applications
RUN npm --prefix server run prisma:generate
RUN npm --prefix server run build
RUN npm --prefix client run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/server/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/server/node_modules/.prisma ./node_modules/.prisma

# Copy built server and client dist
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
