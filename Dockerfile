# Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the static build and API
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
ENV HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/data
EXPOSE 8080
VOLUME /app/data
CMD ["node", "dist-server/index.js"]
