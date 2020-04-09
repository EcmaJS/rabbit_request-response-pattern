#!/usr/bin/env node
const EventEmitter = require("events");

const amqp = require("amqplib/callback_api");

const emitter = new EventEmitter();

const url = {
  protocol: "amqp",
  username: "rabbitmq",
  password: "rabbitmq",
  // hostname: 'rabbit',
  hostname: "localhost",
  port: 5672,
  vhost: "/"
};

function generateCucumberId (cucumberList) {
  const rand = Math.floor(Math.random() * cucumberList.length);
  return cucumberList[rand].id;

}

function generateUuid () {
  return Math.random().toString() +
        Math.random().toString() +
        Math.random().toString();
}



class Rabbit {
  emitter = null;
  connection = null;
  channel = null;
  rpc_queue = 'rpc_queue';
  change_gueue = 'change_gueue';
  ch_gueue = 'ch_gueue'


  constructor (emitter) {
    this.emitter = emitter;
  }

  async connect (url) {
    return await new Promise((resolve, reject) => {
      amqp.connect(url, (err, conn) => {
        if (err) {
          reject(err);
        } else {
          this.connection = conn;
          resolve(conn);
        }
      });
    });
  }

  async channelCreate () {
    return await new Promise((resolve, reject) => {
      this.connection.createChannel((err, channel) => {
        if (err) {
          reject(err);
        } else {
          this.channel = channel;
          resolve(channel);
        }
      });
    });
  }

  async createQueue (queue) {
    return await new Promise((resolve, reject) => {
      this.channel.assertQueue(queue, {
        durable: false
      }, (err, q) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  consumeMessage (q) {
    this.channel.consume(q, (msg) => {
      console.log('[.] Received ', JSON.parse(msg.content));
      this.emitter.emit(msg.properties.correlationId, msg.content);
    }, { noAck: true });
  }

  async request (payload, q) {
    return await new Promise((resolve, reject) => {
      const correlationId = generateUuid();
      this.emitter.on(correlationId, data => {
        resolve(JSON.parse(data));
      });
      this.channel.sendToQueue(
        q,
        Buffer.from(JSON.stringify(payload)),
        {
          correlationId: correlationId,
          replyTo: q
        }
      );
    });
  }
}

(async function () {
  const rabbit = new Rabbit(emitter);
  await rabbit.connect(url);
  await rabbit.channelCreate();
  await rabbit.createQueue(rabbit.rpc_queue);
  rabbit.consumeMessage(rabbit.rpc_queue);
  await rabbit.createQueue(rabbit.change_gueue);
  await rabbit.createQueue(rabbit.ch_gueue);
  const result = await rabbit.request('get cucumber', rabbit.rpc_queue);
  const idSubscriptionCucumber = generateCucumberId(result);
  rabbit.consumeMessage(rabbit.change_queue);
  await rabbit.request({id: idSubscriptionCucumber}, rabbit.change_gueue);
  setInterval(async() => {
    const idSubscriptionCucumber1 = generateCucumberId(result);
    rabbit.consumeMessage(rabbit.change_queue);
    await rabbit.request({id: idSubscriptionCucumber1}, rabbit.change_gueue);
  }, 15000)

})().catch((err) => {
  console.log(err);
});
