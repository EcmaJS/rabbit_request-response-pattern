FROM node:12.9.0-buster


WORKDIR /client

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "send.js"]
 