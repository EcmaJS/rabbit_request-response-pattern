#!/usr/bin/env node

var amqp = require("amqplib/callback_api");

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

amqp.connect(url, function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }
    channel.assertQueue("", {
      exclusive: true
    }, function (error2, q) {
      if (error2) {
        throw error2;
      }
      var correlationId = generateUuid();
      var idObj = 5;

      console.log(" [x] Requesting object with id = %d", idObj);

      channel.consume(q.queue, function (msg) {
        if (msg.properties.correlationId === correlationId) {
          console.log(" [.] Got %s", msg.content);
        }
      }, {
        noAck: true
      });

      channel.sendToQueue("rpc_queue",
        Buffer.from(idObj.toString()), {
          correlationId: correlationId,
          replyTo: q.queue
        });
    });
  });
});
