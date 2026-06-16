FROM node:18-alpine

# Install dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Create reports directory
RUN mkdir -p reports/screenshots reports/logs reports/network reports/traces

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Expose port if needed (for web interface)
# EXPOSE 3000

# Run the server
CMD ["node", "dist/index.js"]
