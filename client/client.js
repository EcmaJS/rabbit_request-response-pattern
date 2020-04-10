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
  change_queue = 'change_queue';
  ch_queue = 'ch_queue';
  exchange = 'exchange';


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

  async createExchange (exchange) {
    return await new Promise((resolve, reject) => {
      this.channel.assertExchange(exchange, 'topic', {
        durable: false
      }, (err, q) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  async createQueue (queue, param) {
    return await new Promise((resolve, reject) => {
      this.channel.assertQueue(queue, param, (err, q) => {
        if (err) {
          reject(err);
        } else {
          resolve(q);
        }
      });
    });
  }

  consumeMessage (q) {
    this.channel.consume(q, (msg) => {
      if(msg !== null) {
      console.log('[.] Received ', JSON.parse(msg.content));
      this.emitter.emit(msg.properties.correlationId, msg.content);}
    }, { noAck: true });
  }

  async subscribe (id, q) {
    this.channel.bindQueue(q.queue, this.exchange, id);
    this.consumeMessage(q.queue);
  }

  async request (payload, q) {
    return await new Promise((resolve, reject) => {
      const correlationId = generateUuid();
      this.emitter.once(correlationId, data => {
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
  await rabbit.createExchange(rabbit.exchange);
  await rabbit.createQueue(rabbit.rpc_queue, { durable: false});
  rabbit.consumeMessage(rabbit.rpc_queue);
  const result = await rabbit.request('get cucumber', rabbit.rpc_queue);
  setInterval(async() => {
    if(rabbit.change_queue !== null) {
      // rabbit.change_queue.unbind(rabbit.exchange, rabbit.idChangeObj);
      rabbit.channel.deleteQueue(rabbit.change_queue);
    }
    idChangeObj = String(generateCucumberId(result));
    const q = await rabbit.createQueue(idChangeObj, 
      { autoDelete: true, 
        exclusive: false,
        durable: false
    })
    rabbit.change_queue = q.queue;
    console.log(idChangeObj)
    await rabbit.subscribe(idChangeObj, q);
  }, 15000)

})().catch((err) => {
  console.log(err);
});
