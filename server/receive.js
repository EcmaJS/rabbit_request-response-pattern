let url = {
        protocol: 'amqp', //amqp or amqps
        username: 'rabbitmq',
        password: 'rabbitmq',
        hostname: 'rabbit',
        port: 5672,
        vhost: '/'
    };

    var q = 'tasks';
    var a = 'response'

    var open = require('amqplib').connect(url);
    
    // Consumer
    open.then(function(conn) {
        return conn.createChannel();
      }).then(function(ch) {
        return ch.assertQueue(a).then(function(ok) {
          return ch.consume(q, function(msg) {
            if (msg !== null) {
              console.log(msg.content.toString(), new Date());
              ch.ack(msg);
              ch.sendToQueue(msg.properties.replyTo, Buffer.from('server response'));
            }
          });
        });
      }).catch(console.warn);
