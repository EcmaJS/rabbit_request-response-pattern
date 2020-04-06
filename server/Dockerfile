FROM node:12.9.0-buster


WORKDIR /server

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "receive.js"]

# CMD ["node", "rpc-server.js"]