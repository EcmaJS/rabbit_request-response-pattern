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
  change_gueue = 'change_gueue';
  ch_gueue = 'ch_gueue'

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

  async consumeMessage (q) {
    return await new Promise((resolve, reject) => {
      this.channel.consume(q, (msg) => {
        const payload = {
          replyTo: msg.properties.replyTo,
          correlationId: msg.properties.correlationId,
          content: JSON.parse(msg.content)
        }
        console.log('[.] ', payload.content)
        this.emitter.emit('delete', payload)
        this.emitter.emit('subscribe', payload)
        this.channel.ack(msg)
        resolve(payload)
      })
    })
  }

  sendChange (obj, correlationId) {
    console.log('[.] Sent change ', obj)
    this.channel.sendToQueue(this.ch_gueue,
      Buffer.from(JSON.stringify(obj), 'utf-8'), {
        correlationId: correlationId
      })
  }

  request (payload) {
      // const r = getObject(payload.content.id)
      this.channel.sendToQueue(payload.replyTo,
        Buffer.from(JSON.stringify(payload.content), 'utf-8'), {
          correlationId: payload.correlationId
        })
        console.log('[.] Sent ', payload.content)
  }
}

function trigger (object) {
  emitter.emit(object.id, object)
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
  await rabbit.createQueue(rabbit.change_gueue)
  await rabbit.createQueue(rabbit.ch_gueue);
  const messageList = await rabbit.consumeMessage(rabbit.rpc_queue)
  let payload = {} 
  payload.content = listCucumbers;
  payload.replyTo = messageList.replyTo;
  payload.correlationId = messageList.correlationId;
  rabbit.request(payload)
  const messageChange = await rabbit.consumeMessage(rabbit.change_gueue)
  let object = {};
  object.id = messageChange.content.id;
  object.replyTo = messageChange.replyTo;
  object.correlationId = messageChange.correlationId;

  emitter.on(object.id, obj => 
    rabbit.sendChange(obj, object.correlationId)
  )

  rabbit.emitter.on('delete', payload => { 
    emitter.removeAllListeners(object.id)
    object.id = payload.content.id
    emitter.on(object.id, obj => 
      rabbit.sendChange(obj, object.correlationId)
    )
  })
})().catch((err) => {
  console.log(err)
})
