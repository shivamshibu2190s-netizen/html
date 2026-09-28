# Use official lightweight Node.js 22 LTS Alpine image (includes built-in node:sqlite)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install dependencies if any
COPY package.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose port (default 3000, cloud providers override via PORT env)
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
