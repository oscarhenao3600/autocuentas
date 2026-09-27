FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install tzdata for Colombia timezone and clean apt cache
ENV TZ=America/Bogota
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install production dependencies cleanly
RUN npm install --omit=dev --no-audit --no-fund

# Copy the rest of the backend source code
COPY . .

# Expose port
EXPOSE 5000

# Start the application directly with node
CMD ["node", "server.js"]
