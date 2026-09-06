FROM node:26-alpine
RUN adduser -D -u 1001 -s /sbin/nologin moin
WORKDIR /usr/src/app
COPY package*.json tsconfig.json bot.ts irc-upd.d.ts ./
RUN mkdir ./data && chown -R moin: /usr/src/app
USER moin
RUN npm install && npm install-scripts approve sqlite3 && npx tsc
CMD ["node", "bot.js"]
