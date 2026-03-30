FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.html ./index.html
COPY server.js ./server.js

ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/gantt.sqlite

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
