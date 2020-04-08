#!/usr/bin/env node
const EventEmitter = require('events')
const amqp = require('amqplib/callback_api')

const emmiter = new EventEmitter()

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

function getObject (id) {
  if (id === object.id) { return object } else { return 'Object not found' }
}

class Rabbit {
  emmiter = null;
  connection = null;
  channel = null;
  rpc_queue = 'rpc_queue';
  change_gueue = 'change_gueue';

  constructor (emmiter) {
    this.emmiter = emmiter
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
          resolve(q)
        }
      })
      this.channel.prefetch(1)
    })
  }

  async consumeMessage (q) {
    return await new Promise((resolve, reject) => {
      this.channel.consume(q, (msg) => {
        const payload = {
          replyTo: msg.properties.replyTo,
          correlationId: msg.properties.correlationId,
          content: JSON.parse(msg.content)
        }
        console.log(' [.] id = %d', payload.content.id)

        this.channel.ack(msg)
        resolve(payload)
      })
    })
  }

  sendChange (obj, correlationId) {
    console.log('[.] Sent ', obj)
    this.channel.sendToQueue(this.change_gueue,
      Buffer.from(JSON.stringify(obj), 'utf-8'), {
        correlationId: correlationId
      })
  }

  request (payload) {
      const r = getObject(payload.content.id)
      this.channel.sendToQueue(payload.replyTo,
        Buffer.from(JSON.stringify(r), 'utf-8'), {
          correlationId: payload.correlationId
        })
        console.log('[.] Sent ', r)
  }
}

function trigger (object) {
  emmiter.emit('change object', object)
}

function updateObj () {
  object.price = Math.floor(Math.random() * Math.floor(10))
  trigger(object)
}

(async function () {
  setInterval(updateObj, 10000)
  const rabbit = new Rabbit()
  await rabbit.connect(url)
  await rabbit.channelCreate()
  await rabbit.createQueue(rabbit.rpc_queue)
  await rabbit.createQueue(rabbit.change_gueue)
  const payload = await rabbit.consumeMessage(rabbit.rpc_queue)
  rabbit.request(payload)
  emmiter.on('change object', obj =>
    rabbit.sendChange(obj, payload.correlationId)
  )
})().catch((err) => {
  console.log(err)
})
