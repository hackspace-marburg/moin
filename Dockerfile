FROM node:26-alpine
WORKDIR /usr/src/app
RUN mkdir ./data
COPY package*.json tsconfig.json config.yml bot.ts irc-upd.d.ts ./
RUN npm install && npm install-scripts approve sqlite3 && npx tsc
CMD ["node", "bot.js"]
