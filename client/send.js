let url = {
    protocol: 'amqp', //amqp or amqps
    username: 'rabbitmq',
    password: 'rabbitmq',
    hostname: 'rabbit',
    port: 5672,
    vhost: '/'
};

var q = 'tasks';
let a = 'response'

var open = require('amqplib').connect(url);

open.then(function(conn) {
  return conn.createChannel();
}).then(function(ch) {
  return ch.assertQueue(q).then(function(ok) {

    setInterval(() => {
    ch.sendToQueue(q, Buffer.from('message from client'), { replyTo: a })
    ch.consume(a, function(msg) {
        if (msg !== null) {
          console.log(msg.content.toString(), new Date());
          ch.ack(msg);
        }
  });
}, 60000)

})
}).catch(console.warn);
