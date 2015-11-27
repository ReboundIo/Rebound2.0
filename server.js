// set up basic express server
var express = require('express');
var app = express();
var mongojs = require('mongojs');
var db = mongojs('mongodb://localhost:27017', ['accounts']);
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var numUsers = 1;
var addedUser;
var usernames;

var COLOR_NAMES = ['maroon', 'red', 'orange', 'yellow', 'olive', 'green', 'purple', 'fuchsia', 'lime', 'teal', 'aqua', 'blue', 'navy', 'black', 'gray', 'silver', 'white'];

var rooms = {}; // map from room name to room object
var userList = {}; // class with users to user objects

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

  for (i = 0; i < this.users.length; i++) {
    usernames.push(this.users[i]);
  }

  return usernames;
};

function User(socket, username) {
  this.socket = socket;
  this.username = username;
  this.room = "1";
}

User.prototype.switchRoom = function(room) {
  this.room = room;
}

function setColor(username, color) {
  userList[username].socket.color = color;
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
  socket.color = 'dimgray';

  socket.on('change username', function (username) {
    socket.user.username = username;
    // use event emitter to emit username change event and have room objects listen for it to update their clients
  });

  socket.on('join room', function (roomName, username) {
    if (rooms[roomName] == undefined) {
      rooms[roomName] = new Room();
    };
    rooms[roomName].addUser(username);
    userList[username] = new User(socket, username);
    socket.join(roomName);
    socket.emit('send roster', rooms[roomName].getUserList());
  });

  socket.on('leave room', function(roomName, username) {
    rooms[roomName].removeUser(username);
    socket.leave(roomName);
    socket.emit('user switch room', username);
  });

  socket.on('send pm', function(sender, recipient, message) {
    userList[recipient].socket.emit('receive pm', sender, message);
  })

  socket.on('new message', function (data, roomNum) {
    if (data.length <= 1000) {

      if (data.split(' ')[0] == "/color") {
        var color = data.split(' ')[1].trim();
        if (COLOR_NAMES.indexOf(color.toLowerCase()) > -1) {
          setColor(socket.username, color.toLowerCase());
          socket.emit('log', 'Your color has been changed to ' + color + '.');
        }
      } else {
        io.sockets.in(roomNum).emit('new message', {
          username: socket.username,
          message: data,
          color: socket.color
        });
      }
    }
  });


  // when a new user joins
  socket.on('add user', function (username, password) {
    db.accounts.findOne({ "username" : username, "password" : password }, function(err, docs) {
      if (docs) {
        // store the username in the socket session for this client
        socket.username = username;
        // add client's username to global listen
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
        socket.emit('alertrefresh', 'ACCOUNT CREATION CANCELED: That username is taken. Try again.');
      } else if (username.split('').indexOf('<') != -1) {
        socket.emit('alertrefresh', "ACCOUNT CREATION CANCELED: The '<' character is not allowed.");
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

    if (addedUser) {
      --numUsers;
      rooms[socket.user.room].removeUser(socket.username);

      // echo to all other clients that someone left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

});
