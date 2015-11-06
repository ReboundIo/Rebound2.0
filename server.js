// set up basic express server
var express = require('express');
var prompt = require('prompt');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 80;
var COLOR_NAMES = ['maroon', 'red', 'orange', 'yellow', 'olive', 'green', 'purple', 'fuchsia', 'lime', 'teal', 'aqua', 'blue', 'navy', 'black', 'gray', 'silver', 'white', 'indianred', 'lightcoral', 'salmon', 'darksalmon', 'lightsalmon', 'crimson', 'firebrick', 'darkred', 'greenyellow', 'chartreuses', 'lawngreen', 'lime', 'limegreen', 'palegreen', 'lightgreen', 'mediumspringgreen', 'springgreen', 'mediumseagreen', 'seagreen', 'forestgreen', 'darkgreen', 'yellowgreen', 'olivedrab', 'darkolivegreen', 'mediumaquamarine','darkseagreen', 'lightseagreen', 'darkcyan', 'cornsilk', 'blanchedalmond', 'bisque', 'navajowhite', 'wheat', 'burlywood', 'tan', 'rosybrown', 'sandybrown', 'goldenrod', 'darkgoldenrod', 'peru', 'chocolate', 'saddlebrown', 'sienna', 'brown', 'maroon', 'lightsalmon', 'coral', 'tomato', 'orangered', 'darkorange', 'orange', 'gold', 'yellow', 'lightyellow', 'lemonchiffon', 'lightgoldenrodyellow', 'papayawhip', 'moccasin', 'peachpuff', 'palegoldenrod', 'khaki', 'darkkhaki', 'snow', 'honeydew', 'mintecream', 'azure', 'aliceblue', 'ghostwhite', 'whitesmoke', 'seashell', 'beige', 'oldlace', 'floralwhite', 'ivory', 'antiquewhite', 'linen', 'lavenderblush', 'mistyrose', 'aqua', 'cyan', 'lightcyan', 'paleturquoise', 'aquamarine', 'turquoise', 'mediumturquoise', 'darkturquoise', 'cadetblue', 'steelblue', 'lightsteelblue', 'powderblue', 'lightblue', 'skyblue', 'lightskyblue', 'deepskyblue', 'dodgerblue', 'cornflowerblue', 'mediumslateblue', 'royalblue', 'blue', 'mediumblue', 'darkblue', 'navy', 'midnightblue', 'lavender', 'thistle', 'plum', 'violet', 'orchid', 'magenta', 'mediumorchid', 'mediumpurple', 'amethyst', 'blueviolet', 'darkviolet', 'darkorchid', 'darkmagenta', 'purple', 'indigo', 'gainsboro', 'lightgrey', 'silver', 'darkgray', 'gray', 'dimgray', 'lightslategray', 'slategray', 'darkslategray', 'pink', 'lightpink', 'hotpink', 'deeppink', 'mediumvioletred', 'palevioletred'];

prompt.start();

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

});//----------- define functions for prompt commands

function setColor(username, color) {
    usernames[username].color = color;
}

function spin(username) {
    usernames[username].emit('spin');
    sendSystemMessage(username + " has been spun by an administrator.");
}

function kick(username) {
    usernames[username].emit('alert', 'You have been kicked from the server.');
    usernames[username].disconnect();
    sendSystemMessage(username + " has been kicked.");
}

function kickAll() {
    for (var username in usernames) {
        kick(username);
    }
}

//------------------------------------------------

(function get() {
    prompt.get(['command'], function(error, result) {
        if (result.command == 'system') {
            prompt.get(['message'], function(error, result) {
                sendSystemMessage(result.message);
                get();
            });
        }
        /* how to add a prompt command
        if (result.command == 'keyword here') {
            prompt.get(['any extra information you might need'], function(error, result) {
              someFunction(result.yourExtraInfo);
              get();
            });
          }
        */
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
        if (result.command == 'spin') {
            prompt.get(['username'], function(error, result) {
                spin(result.username);
                get();
            });
        }
        if (result.command == 'kickall') {
            kickAll();
            get();
        }
    });
})();
