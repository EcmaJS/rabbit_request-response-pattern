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
  title: 'my-data',
  price: 5
}
    

let open = require('amqplib').connect(url);

async function publishMessage(obj) {
  open.then(function(conn) {
    return conn.createChannel();
  }).then(function(ch) {
    return ch.assertQueue(a).then(function(ok) {
      ch.sendToQueue(a, Buffer.from(JSON.stringify(obj),'utf-8'));
    })
  }).catch(console.warn);
}

async function getMessage(ch) {  
  return ch.assertQueue(a).then(function(ok) {
    return ch.consume(q, function(msg) {
      if (msg !== null) {
        let msgBody = msg.content.toString();
        console.log(msgBody, new Date());
        let request = JSON.parse(msgBody);
        if(request.data == obj.title) {
          // ch.ack(msg);
          publishMessage(obj)
        }
      }
    });
  });
}

function trigger (obj) {
  publishMessage(obj)
}

function updateObj() {
  obj.price = Math.floor(Math.random() * Math.floor(10))
  trigger(obj)
}

    
open.then(function(conn) {
  return conn.createChannel();
}).then(ch => {getMessage(ch)}
).catch(console.warn);

setInterval(updateObj, 30000)
