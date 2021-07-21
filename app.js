const express = require('express');
const mongodb= require('mongodb')

const app = express();
app.use(express.static('public'));

var bodyParser = require('body-parser');
var parseUrlencoded = bodyParser.urlencoded({ extended: false });

//create Http Server Which dispateches request to express
const server = require('http').createServer(app);
//Socket allowed to listen for requests: socket and expresss are sharing the same http server
const io = require('socket.io')(server);

const url = 'mongodb://localhost:27017/chatRoom'
const MongoClient = mongodb.MongoClient


MongoClient.connect(url, function(err, database)  {
  if (err) return process.exit(1)
  //Added event to get the chatter username
  const myDB = database.db('chatRoom')

  io.on('connection', function(client){
    console.log('Client Connected');
    //If a client joins then he is added to the database
    client.on('join', function(name){
      client.username = name;
      myDB.collection('users').insert({name:name}, function(error, results) {
        if (error) return process.exit(1)
     })
    });

    //if a client is connected he can read the old messages
    myDB.collection('messages').find({}).toArray((error, oldmessages) => {
      if (error) return next(error)
      client.emit('oldmessages', {old: oldmessages});
  })

    //if a message is received so it is added to the database and broadcasted
    client.on('messages', function(data){
      //broadcast the message to all the Connected clients
      client.broadcast.emit('messages', client.username + ":" + data);
      //Insert into DB
      myDB.collection('messages').insert({name:client.username, message:data},
        function(error, results) {
        if (error) return process.exit(1)
     })
    });
  });

  app.get('/api/messages', (req, res) => {
    myDB.collection('messages')
      .find({}, {sort: {_id: -1}})
      .toArray((error, messages) => {
        if (error)  return process.exit(1)
        res.send(messages)
    })
  })

  app.post('/api/messages/', parseUrlencoded, (req, res) => {
    let newMessage = req.body
    myDB.collection('messages').insert(newMessage, (error, results) => {
      if (error) { console.log(error) ; return process.exit(1)}
      res.send(results)
    })
  })

  app.put('/api/messages/:id', parseUrlencoded,(req, res) => {
    let newMessage = req.body

    myDB.collection('messages')
      .update({_id: mongodb.ObjectID(req.params.id)},
      {$set: {
        name:newMessage.name,
        message: newMessage.message}
      }, (error, results) => {
      if (error) return process.exit(1)
      res.send(results)
    })
  })

  app.delete('/api/messages/:id', parseUrlencoded,(req, res) => {
   myDB.collection('messages').remove({_id:mongodb.ObjectID( req.params.id)}, (error, results) => {
    if (error) return process.exit(1)
    res.send(results)
   })
  })
})
server.listen(8080);
