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

# Accept build-time environment variables
# Optional build-time passthroughs (set via CI/CD or docker build --build-arg)
ARG NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS=${NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS}

ARG NEXT_PUBLIC_AGENT_ADDRESS=0x901F333fF680a73C5398dAFA53c87B517B3B864E
ENV NEXT_PUBLIC_AGENT_ADDRESS=$NEXT_PUBLIC_AGENT_ADDRESS

ARG NEXT_PUBLIC_AGENT_CONTRACT=0x8888485CeA96e1524C50DF0Fbae7fc7dc385d38D
ENV NEXT_PUBLIC_AGENT_CONTRACT=$NEXT_PUBLIC_AGENT_CONTRACT

ARG NEXT_PUBLIC_AGENT_CONTROLLER=0xFFB2Df4F2cFc487B0941B89A1AAf9d0f7C340B30
ENV NEXT_PUBLIC_AGENT_CONTROLLER=$NEXT_PUBLIC_AGENT_CONTROLLER

ARG NEXT_PUBLIC_ETH_AGENT_CONTRACT=0x19De520a0D3F67A0471f4277130344712230a300
ENV NEXT_PUBLIC_ETH_AGENT_CONTRACT=$NEXT_PUBLIC_ETH_AGENT_CONTRACT

ARG NEXT_PUBLIC_ETH_AGENT_CONTROLLER=0x756519FecE5027F37627d818bA5758c36A8cB10f
ENV NEXT_PUBLIC_ETH_AGENT_CONTROLLER=$NEXT_PUBLIC_ETH_AGENT_CONTROLLER

ARG NEXT_PUBLIC_SEPOLIA_AGENT_CONTRACT=0xEb84be2228D943983b7aB6e95fd3f505780d51C7
ENV NEXT_PUBLIC_SEPOLIA_AGENT_CONTRACT=$NEXT_PUBLIC_SEPOLIA_AGENT_CONTRACT

ARG NEXT_PUBLIC_SEPOLIA_AGENT_CONTROLLER=0x457FAFDF454047E3aEdF54Cd0eCe9ef8d731B788
ENV NEXT_PUBLIC_SEPOLIA_AGENT_CONTROLLER=$NEXT_PUBLIC_SEPOLIA_AGENT_CONTROLLER

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
