$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput
  var roomID = "1";
  var currentRoster = [];

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "There is 1 user connected.";
    } else {

    }
    log(message);
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      password = document.getElementById('pwdinput').value;

      // Tell the server your username
      socket.emit('add user', username, password);
      socket.emit('join room', '1', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      // tell server to execute 'new message' and send along one parameter
      if (message == "/help") {
        log("AVAILABLE COMMANDS:");
        log("/theme - shows list of available themes");
        log("/theme <themechoice> - changes theme");
        log("/color - shows list of available colors");
        log("/color <colorchoice> - changes your username color");
        log("/pm <username> <message> - sends a private message to a user");
        log("/room <room name/number> - leaves your current room and joins a new one");
        log("/global <message> - sends a message to everyone, no matter what chat room they're in");
      } else if (message.split(' ')[0] == "/kick") {
        socket.emit('kick request', username, message.split(' ')[1]);
      } else if (message.split(' ')[0] == "/pm") {
        var privateMessageArray = message.split(' ');
        privateMessageArray.splice(0, 1);
        privateMessageArray.splice(0, 1);
        privateMessageArray = privateMessageArray.join();
        for (i=0;i<999;i++) { privateMessageArray.replace(',', ' ') };
        socket.emit('send pm', username, message.split(' ')[1], privateMessageArray)
        log("You sent " + message.split(' ')[1] + ": " + privateMessageArray);
      } else if (message.split(' ')[0] == "/global") {
        socket.emit('global message', message);
      } else if (message == "/color") {
        log("The available colors are: maroon, red, orange, yellow, olive, green, purple, fuchsia, lime, teal, aqua, blue, navy, black, silver, gray, white.");
      } else if (message.split(' ')[0] == "/room") {
        socket.emit('leave room', roomID);
        for (i = 0;i < currentRoster.length;i++) {
          removeUserFromRoster(currentRoster[i]);
        };
        users = {};
        roomID = message.split(' ')[1];
        socket.emit('join room', message.split(' ')[1], username);
        log("You have joined room " + message.split(' ')[1] + ".");
      } else if (message == "/theme") {
        log("\n");
        log("THEME CHOICES:");
        log("note: compact is the default theme");
        log("compact");
        log("cozy");
        log("fire");
        log("party");
      } else if (message.split(' ').length == 2) {
        if (message.split(' ')[0] == "/theme") {
          if (message.split(' ')[1] == "compact") {
            swapStyleSheet("styles/compact.css");
          } else if (message.split(' ')[1] == "cozy") {
            swapStyleSheet("styles/cozy.css");
          } else if (message.split(' ')[1] == "party") {
            swapStyleSheet("styles/party.css");
            new Audio('./party.mp3').play();
          } else if (message.split(' ')[1] == "fire") {
            swapStyleSheet("styles/fire.css");
          } else {
            log("\n");
            log("That theme doesn't exist.");
          }
        } else if (message.split(' ')[0] == "/color") {
          socket.emit('new message', message, roomID);
        } else {
          socket.emit('new message', message, roomID);
        }
      } else {
        socket.emit('new message', message, roomID);
      }
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var currentDate = new Date();
    var datetime = currentDate.getHours() + ":"
    + currentDate.getMinutes() + ":"
    + currentDate.getSeconds() + " ";

    var $timestampDiv = $('<span class="timestamp">')
      .text(datetime)
      .css('color', 'dimgray')
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', data.color);
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($timestampDiv, $usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing...';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function createAccount() {

    desiredUsername = prompt("What is your desired username? \nThis will show up as your name when you send messages.");
    desiredPassword = prompt("What is your desired password?");
    socket.emit('new user account', desiredUsername, desiredPassword);

  }

  var userItems = {};

  function addUserToRoster(username) {

    var userItem = document.createElement('li');
    userItem.innerHTML = username;
    userRoster.appendChild(userItem);
    userItems[username] = userItem;
    currentRoster.push(username);

  }

  function removeUserFromRoster(username) {

    if (userItems[username] != undefined || null) {
      userRoster.removeChild(userItems[username]);
      currentRoster.splice(currentRoster.indexOf(username), 1);
    }

  }

  function swapStyleSheet(sheet) {
    document.getElementById('pagestyle').setAttribute('href', sheet);
  }

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message

    var message = "Welcome to Rebound 2. Type /help to view commands.";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' connected to the server.');
    addParticipantsMessage(data);
    addUserToRoster(data.username);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' disconnected from the server.');
    addParticipantsMessage(data);
    removeChatTyping(data);
    removeUserFromRoster(data.username);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('send roster', function(rosterList) {
    console.log(rosterList);
    for (i = 0; i < rosterList.length; i++) {
      addUserToRoster(rosterList[i]);
    }
  });

  socket.on('user switch room', function(usern) {
    removeUserFromRoster(usern);
  });

  socket.on('log', function(message) {
    log(message);
  });

  socket.on('kick', function() {
    alert("You have been kicked.");
  })

  socket.on('receive pm', function(sender, message) {
    log(sender + " sent you: " + message);
  })

  socket.on('alert', function(alertMessage) {
    alert(alertMessage);
  });

  socket.on('alertrefresh', function(alertMessage) {
    alert(alertMessage);
    window.location=window.location;
  });
});
