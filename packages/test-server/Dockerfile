FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install

COPY backend/ ./

COPY frontend/ ./frontend/

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    JWT_SECRET=change-me-in-production \
    AUTH_TYPE=email-password \
    AUTH_FLOW=single-page \
    TOKEN_TYPE=cookie \
    CUSTOM_HEADER_NAME=X-Auth-Token

CMD ["node", "server.js"]