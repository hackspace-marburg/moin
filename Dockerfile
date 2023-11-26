# Use a lightweight Node.js image as base
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

RUN mkdir ./data

COPY package*.json config.yml bot.ts ./

# Install TypeScript and other dependencies
RUN npm install -g typescript && npm install @types/node && npm install

# Compile TypeScript to JavaScript
RUN npm install irc express sqlite3 js-yaml
RUN tsc bot.ts

# Run the bot when the container starts
CMD ["node", "bot.js"]
