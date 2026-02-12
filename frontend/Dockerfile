# Multi-stage build for optimized production deployment
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies with cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy source code
COPY . .

# Build-time environment variables (client-side, baked into bundle)
ARG NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS
ENV NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS=$NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS

ARG NEXT_PUBLIC_TREASURY_ADDRESS
ENV NEXT_PUBLIC_TREASURY_ADDRESS=$NEXT_PUBLIC_TREASURY_ADDRESS

ARG NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS=${NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS}

# Build the application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production runner (minimal size)
FROM node:20-alpine AS runner
WORKDIR /app

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy only necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.env.production ./.env.production

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Use node directly for better performance
CMD ["node", "server.js"]
