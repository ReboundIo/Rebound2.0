// set up basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 80;

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

  // on a new message
  socket.on('new message', function (data) {
    // tell the client to add a new message
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when a new user joins
  socket.on('add user', function (username) {
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
  });

  socket.on('typing', function() {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client stops typing, tell everyone else
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when someone disconnects, do this
  socket.on('disconnect', function () {
    // remove username from global usernames listen
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo to all other clients that someone left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

});
