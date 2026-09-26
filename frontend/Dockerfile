# Build stage
FROM node:20-alpine as build

WORKDIR /app
COPY package*.json ./

# Limit node memory to 512MB to prevent OOM killer on 1GB Raspberry Pi 3
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
