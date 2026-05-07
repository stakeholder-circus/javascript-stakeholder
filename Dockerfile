FROM node:26-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY biome.json ./
COPY core ./core
COPY scripts ./scripts
COPY src ./src
COPY test ./test

RUN npm run lint
RUN npm run build
RUN npm test

EXPOSE 3344
ENTRYPOINT ["node", "src/index.js"]
