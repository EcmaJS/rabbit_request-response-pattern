#!/usr/bin/env node
const EventEmitter = require('events')
const amqp = require('amqplib/callback_api')

const emitter = new EventEmitter()

const url = {
  protocol: 'amqp',
  username: 'rabbitmq',
  password: 'rabbitmq',
  // hostname: 'rabbit',
  hostname: 'localhost',
  port: 5672,
  vhost: '/'
}

const object = {
  id: 5,
  price: 15
}

const listCucumbers = require('./cucumbers');

function getObject (id) {
  if (id === object.id) { return object } else { return 'Object not found' }
}

class Rabbit {
  emitter = null;
  connection = null;
  channel = null;
  rpc_queue = 'rpc_queue';
  change_queue = 'change_queue';
  ch_queue = 'ch_queue'
  exchange = 'exchange'

  constructor (emitter) {
    this.emitter = emitter
  }

  async connect (url) {
    return await new Promise((resolve, reject) => {
      amqp.connect(url, (err, conn) => {
        if (err) {
          reject(err)
        } else {
          this.connection = conn
          resolve(conn)
        }
      })
    })
  }

  async channelCreate () {
    return await new Promise((resolve, reject) => {
      this.connection.createChannel((err, channel) => {
        if (err) {
          reject(err)
        } else {
          this.channel = channel
          resolve(channel)
        }
      })
    })
  }

  async createQueue (queue) {
    return await new Promise((resolve, reject) => {
      this.channel.assertQueue(queue, {
        durable: false
      }, (err, q) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
      this.channel.prefetch(1)
    })
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

  async consumeMessage (queue) {
      this.channel.consume(queue, (msg) => {
      const payload = {
          replyTo: msg.properties.replyTo,
          correlationId: msg.properties.correlationId
        }
        this.emitter.emit('received message', payload);
        this.channel.ack(msg) 
      })
  }

  publishChange (obj, id) {
    // console.log('[.] Publish change ', obj)
    // console.log(id)
    this.channel.publish(this.exchange, id,
      Buffer.from(JSON.stringify(obj), 'utf-8'), )
  }

  request (payload) {
        this.channel.sendToQueue(payload.replyTo,
          Buffer.from(JSON.stringify(payload.content), 'utf-8'), {
            correlationId: payload.correlationId
          })
          console.log('[.] Sent ', payload.content)
  }
}

function trigger (object) {
  emitter.emit('change objects', object)
}

function updateObjects () {
  for (cucumber of listCucumbers) {
    cucumber.price = Math.round(cucumber.id * 10 + Math.random() * 10);
    trigger(cucumber)
  }

}

(async function () {
  setInterval(updateObjects, 5000)
  const rabbit = new Rabbit(emitter)
  await rabbit.connect(url)
  await rabbit.channelCreate()
  await rabbit.createQueue(rabbit.rpc_queue)
  await rabbit.createExchange(rabbit.exchange);
  await rabbit.consumeMessage(rabbit.rpc_queue);
  rabbit.emitter.once('received message', payload => {
    payload.content = listCucumbers;
    rabbit.request(payload)
  })
  emitter.on('change objects', obj => {
    const id = String(obj.id)
    rabbit.publishChange(obj, id)
  })

})().catch((err) => {
  console.log(err)
})
