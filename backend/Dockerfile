FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install tzdata for Colombia timezone
RUN apk add --no-cache tzdata
ENV TZ=America/Bogota

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install production dependencies cleanly
RUN npm install --omit=dev --no-audit --no-fund

# Copy the rest of the backend source code
COPY . .

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
