 
#!/usr/bin/env node
const EventEmitter = require("events");
const amqp = require("amqplib/callback_api");

const emmiter = new EventEmitter();

const url = {
  protocol: "amqp",
  username: "rabbitmq",
  password: "rabbitmq",
  // hostname: 'rabbit',
  hostname: "localhost",
  port: 5672,
  vhost: "/"
};

function generateUuid () {
  return Math.random().toString() +
        Math.random().toString() +
        Math.random().toString();
}

class Rabbit {
  emmiter = null;
  connection = null;
  channel = null;
  rpc_queue = 'rpc_queue';
  change_gueue = 'change_gueue';

  constructor (emmiter) {
    this.emmiter = emmiter;
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
        // exclusive: true
      }, (err, q) => {
        if (err) {
          reject(err);
        } else {
          // queue = q
          resolve(q);
        }
      });
    });
  }

  consumeMessage (q) {
    this.channel.consume(q, (msg) => {
      console.log(JSON.parse(msg.content));
      this.emmiter.emit(msg.properties.correlationId, msg.content);
    }, { noAck: true });
  }

  async request (payload) {
    return await new Promise((resolve, reject) => {
      const correlationId = generateUuid();
      this.emmiter.once(correlationId, data => {
        resolve(JSON.parse(data));
      });
      this.channel.sendToQueue(
        "rpc_queue",
        Buffer.from(JSON.stringify(payload)),
        {
          correlationId: correlationId,
          replyTo: this.rpc_queue
        }
      );
    });
  }
}

(async function () {
  const rabbit = new Rabbit(emmiter);
  await rabbit.connect(url);
  await rabbit.channelCreate();
  await rabbit.createQueue(rabbit.rpc_queue);
  rabbit.consumeMessage(rabbit.rpc_queue);
  await rabbit.createQueue(rabbit.change_gueue);
  const result = await rabbit.request({ id: 5 });
  console.log("result", result);
  rabbit.consumeMessage(rabbit.change_gueue);
})().catch((err) => {
  console.log(err);
});