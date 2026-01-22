FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev && rm -rf /root/.npm /tmp/*

COPY src ./src

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD wget -q -O - http://localhost:8080/health || exit 1

CMD ["node", "src/index.js"]
