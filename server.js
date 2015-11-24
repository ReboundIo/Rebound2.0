// set up basic express server
var express = require('express');
var app = express();
var mongojs = require('mongojs');
var db = mongojs('mongodb://localhost:27017', ['accounts']);
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

var rooms = {}; // map from room name to room object

function Room() {
  this.users = [];
}
Room.prototype.addUser = function(user) {
  this.users.push(user);
};
Room.prototype.removeUser = function(user) {
  this.users.splice(this.users.indexOf(user), 1);
};
Room.prototype.getUserList = function() {
  usernames = [];

  for (var i = 0; i < this.users.length; i++) {
    usernames.push(this.users[i].username);
  }
};

function User(socket, username) {
  this.socket = socket;
  this.username = username;
}

// tell server to start listening for connections
server.listen(port, function () {
  console.log("Server listening at port %d", port);
});

// routing
app.use(express.static(__dirname + '/public'));

// chatroom

// usernames which are currently connected to the chatroom

io.on('connection', function (socket) {
  socket.user = new User(socket, 'Anonymous');

  socket.on('change username', function (username) {
    socket.user.username = username;
    // use event emitter to emit username change event and have room objects listen for it to update their clients
  });

  socket.on('join room', function (roomName, username) {
    if (roomCounts[roomN] == undefined || 0) {
      roomCounts[roomN] = 0;
    };
    if (roomRosters[roomN] == undefined) {
      roomRosters[roomN] = [];
    };
    roomRosters[roomN].push(username);
    roomCounts = roomCounts + 1;
    userTracker[username] = roomN;
    socket.emit('send roster', roomRosters[roomN]);
  });

  socket.on('leave room', function(roomN, username) {
    roomRosters[roomN].splice(roomRosters[roomN].indexOf(username), 1);
    roomCounts[roomN] = roomCounts - 1;
    userTracker[username] = undefined;
    socket.leave(roomN);
    socket.emit('user switch room', username);
  });

  socket.on('new message', function (data, roomNum) {
    // tell the client to add a new message
    io.sockets.in(roomNum).emit('new message', {
      username: socket.username,
      message: data
    });
  });


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
    if (userTracker[socket.username] != undefined) {
      roomRosters[userTracker[socket.username]].splice(socket.username, 1);
    }
  });

});
