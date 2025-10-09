FROM node:22-alpine

# Cache-bust argument - changes every build
ARG CACHE_BUST=1

WORKDIR /app

# Set HOME directory for SDK cli.js subprocess
ENV HOME=/app

# Create writable directories for SDK temporary files and configuration
# CRITICAL FIX: SDK subprocess needs writable .claude directory with proper ownership
RUN mkdir -p /tmp /app/.claude && chmod 1777 /tmp && chown -R node:node /app/.claude

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# CRITICAL FIX: Ensure .claude directory is writable for SDK subprocess
# The SDK spawns cli.js which needs to write config/cache to ~/.claude
RUN chmod -R 777 /app/.claude && mkdir -p /tmp && chmod 1777 /tmp

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start server
CMD ["node", "dist/server.js"]
