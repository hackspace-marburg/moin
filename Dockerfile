FROM node:26-alpine
WORKDIR /usr/src/app
RUN mkdir ./data
COPY package*.json tsconfig.json config.yml bot.ts ./
RUN npm install && npx tsc
CMD ["node", "bot.js"]
