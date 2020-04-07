let url = {
    protocol: 'amqp',
    username: 'rabbitmq',
    password: 'rabbitmq',
    hostname: 'rabbit',
    // hostname: 'localhost',
    port: 5672,
    vhost: '/'
};

let q = 'request';
let a = 'response';

let obj = {
  data:"my-data"
}

let open = require('amqplib').connect(url);

open.then(function(conn) {
  return conn.createChannel();
}).then(function(ch) {  
  return ch.assertQueue(q).then(function(ok) {
    ch.sendToQueue(q, Buffer.from(JSON.stringify(obj),'utf-8'), { replyTo: a })
    ch.consume(a, function(msg) {
      if (msg !== null) {
        console.log(msg.content.toString(), new Date());
        ch.ack(msg);
      }
   });
 })
}).catch(console.warn);
