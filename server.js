// set up basic express server
var express = require('express');
var app = express();
var mongojs = require('mongojs');
var db = mongojs('mongodb://localhost:27017', ['accounts']);
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

// tell server to start listening for connections
server.listen(port, function () {
  console.log("Server listening at port %d", port);
});

// routing
app.use(express.static(__dirname + '/public'));

// chatroom

// usernames which are currently connected to the chatroom

var usernames = {};
var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  // when a new user joins
  socket.on('add user', function (username, password) {
    db.accounts.findOne({ "username" : username, "password" : password }, function(err, docs) {
      if (docs) {
        // store the username in the socket session for this client
        socket.username = username;
        // add client's username to global listen
        usernames[username] = username;
        ++numUsers;
        addedUser = true;
        socket.emit('login', {
          numUsers: numUsers
        });

        // echo to all clients that a person has connected
        socket.broadcast.emit('user joined', {
          username: socket.username,
          numUsers: numUsers
        });
      } else {
        socket.emit('alertrefresh', 'That user does not exist. Try again or create an account.');
      }
    });
  });

  socket.on('new user account', function(username, password) {

    db.accounts.findOne({ "username" : username }, function(err, docs) {

      if (docs) {
        socket.emit('alertrefresh', 'That username is taken. Try again.');
      } else {
        db.accounts.save({ "username" : username, "password" : password });
      }

    })

  });
});
