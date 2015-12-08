// set up basic express server
var express = require('express');
var prompt = require('prompt');
var app = express();
var mongojs = require('mongojs');
var fs = require('fs');
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

prompt.start();

if (!fs.existsSync('config.json')) {
    console.log('`config.json` not found. Creating example configuration...');

    config = {
        port: 3000,
        admins: [],
        messageLimitWindow: 5,
        messageLimit: 5
    };

    saveConfiguration(function() {
        loadConfiguration(function() {
            startServer();
        });
    });
}

else {
    loadConfiguration(function() {
        startServer();
    })
}

function loadConfiguration(callback) {
    config = JSON.parse(fs.readFileSync('config.json'));
    console.log('Read configuration from `config.json`.');

    if (config.admins === undefined || config.admins.length < 1) {
        console.log('No admins are set. Please set one to enable administrative commands. (Leave blank to skip.)');

        prompt.get([{
            name: 'password',
            hidden: true
        }], function(error, result) {
            if (result.password === '') {
                console.log('Skipped adding admins.');
                callback();
            }

            else {
                config.admins.push(result.password);
                console.log('Added admin. Logging in with this username will grant admin privileges.');
                saveConfiguration(function() {
                    callback();
                });
            }
        });
    }

    else {
        callback();
    }
}

function saveConfiguration(callback) {
    fs.writeFile('config.json', JSON.stringify(config, null, 4), function(error) {
        if (error) {
            throw error;
        }

        console.log('Saved configuration to `config.json`.');
        callback();
    });
}


function startServer() {
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

  function User(socket, username, privLevel) {
    this.socket = socket;
    this.username = username;
    this.room = "1";
    this.privileges = privLevel;
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

          userList[username] = new User(socket, username, undefined);

          if (config.admins.indexOf(username) > -1) {
            userList[username].privileges = "admin";
          } else {
            userList[username].privileges = "user";
          }

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

    socket.on('kick request', function(user, kickee) {
      if (userList[user].privileges == "admin") {
        kick(kickee);
      } else {
        socket.emit('alert', "You must be an admin to use that.");
      }
    });

    socket.on('global message', function(message) {
      socket.broadcast.emit('new message', message);
    })

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
        //rooms[socket.user.room].removeUser(socket.username);

        // echo to all other clients that someone left
        socket.broadcast.emit('user left', {
          username: socket.username,
          numUsers: numUsers
        });
      }
    });

  });

  function kick(username) {
    userList[username].socket.emit('kick');
    userList[username].socket.disconnect();
  }

  (function get() {
      prompt.get(['command'], function(error, result) {
          if (result.command == 'system') {
              prompt.get(['message'], function(error, result) {
                  sendSystemMessage(result.message);
                  get();
              });
          }
          if (result.command == 'kick') {
              prompt.get(['username'], function(error, result) {
                  kick(result.username);
                  get();
              });
          }
          if (result.command == 'color') {
              prompt.get(['username', 'color'], function(error, result) {
                  setColor(result.username, result.color)
                  get();
              });
          }
      });
  })();
}
