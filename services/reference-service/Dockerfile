FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY data/ ./data/

EXPOSE 6773

CMD ["node", "src/index.js"]
