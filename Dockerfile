# Build the React widget (web/) into static assets, then run the Node server.
FROM node:20-alpine AS widget-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY --from=widget-build /app/web/dist ./web/dist

CMD ["node", "src/index.js"]
