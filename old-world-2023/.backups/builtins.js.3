// Some basic command to get us started

// The fairy godmother from Discworld MUD here to help us in Nodeventure
command('godmother', "When you're really stuck and need a little help to get home", function (rest, player, game) {

  player.display.show('http://images.wikia.com/ammondisney/images/f/fe/Fairy_Godmother.gif', 'xxx',{left:"50%", bottom: "0px"});

  player.getCurrentRoom().broadcast(player.name + "'s fairy godmother appears in a flash of helpfulness");
  player.getCurrentRoom().broadcast(player.name + "'s fairy godmother: oh dear! what have you done, do you need help getting home?");
  player.getCurrentRoom().broadcast(player.name + "'s fairy godmother: click your heels by typing 'clickheels' and I'll help you home.");
  player.godmotherPresent = true;
});

command('clickheels', function (rest, player, game) {
  player.write('You click your heels');
  player.getCurrentRoom().broadcast(player.name + ' clicks their heels', player);
  if (player.godmotherPresent) {
    player.getCurrentRoom().broadcast(player.name + "'s hairy fairy godmother: Ok, but don't get yourself lost again!");
    player.setCurrentRoom('home');
    player.execute('look');
    player.godmotherPresent = false;
  } else {
    player.getCurrentRoom().broadcast('Nothing happens, but in a definitive way.');
  }
});

command('commands', 'list all commands available in the game', function (rest, player, game) {
  player.write('Available commands: ' + _.without(_.keys(game.commands), 'teleport').join(", "));
});

command('help', 'get you some help! Example: "help <command>"', function (rest, player, game) {
  if (rest) {
      var command = game.commands[rest];
      if (command) {
        player.write(rest + ': ' + command.description);
      } else {
        player.write("I don't recognise that command");
      }
    } else {
      player.write('Try typing "commands" to get a list of commands then "help <command>" for more info.\nSome other thngs to try: "go <direction>" to move, "say <message>" to talk and "look" to look around');
    }
});

command('get', 'Pick up an item from the current room.', function (rest, player, game) {
  var item = player.getCurrentRoom().getItem(rest);
  if (item) {
    if (item.gettable !== false) {
      // We use an event so it can be overridden for different items, see below for the default implementation
      game.emitEvent("get", item.name, player, item);
    } else {
      player.write("You can not get the " + rest);
    }
  } else {
    player.write("Sorry, the item: " + rest + ", is not here.");
  }
});

command('take', "Alias for 'get'", function(rest, player, game) {
  game.execute(player, 'get ' + rest);
});

command('drop', 'Leave an item from your inventory in the current room.', function (itemName, player, game) {
  var item = _.find(player.inventory, function (it) {
    return itemName === it.name;
  });
  if (item) {
    // We use an event so it can be overridden for different items, see below for the default implementation
    game.emitEvent("drop", itemName, player, item);
  } else {
    player.write("The " + itemName + " is not in your inventory.");
  }
});

command('inventory', "Display a list of all the items you're carrying.", function (rest, player, game) {
  player.inventory = player.inventory || [];
  console.log(player.inventory);
  if (player.inventory.length == 0) {
    player.write("You aren't carrying anything. Travel light!");
  }
  _.each(player.inventory, function (item) {
    player.write('You are carrying ' + (item.short || item.name));
  });
});

command('use', 'Example: use lemon',function (rest, player, item) {
  // This is just the default. See itemCommand definitions for different items
  player.write("Can't use " + rest);
});

command('go', 'use an exit, for example "go north"', function (rest, player, game) {
  var currentRoom = player.getCurrentRoom(),
      direction = rest.toLowerCase(),
      destination = currentRoom.getExit(direction);
  if (destination) {
    player.setCurrentRoom(destination);
    player.write("You go " + rest);
    player.execute("look");
  } else {
    player.write("There is no " + rest + " exit");
  }
});

command('n', 'Shortcut for going north.',function (rest, player, game) {
  game.execute(player, "go north");
});

command('s','Shortcut for going south.', function (rest, player, game) {
  game.execute(player, "go south");
});

command('e', 'Shortcut for going east.', function (rest, player, game) {
  game.execute(player, "go east");
});

command('w','Shortcut for going west.',function (rest, player, game) {
  game.execute(player, "go west");
});

command('u', 'Shortcut for going up.', function (rest, player, game) {
  game.execute(player, "go up");
});

command('d','Shortcut for going down.',function (rest, player, game) {
  game.execute(player, "go down");
});

command('exits', "List the available exits", function (rest, player, game) {
  var exits = Object.keys(player.getCurrentRoom().exits);
  player.write("Exits: " + exits.join(","));
});

command('teleport', '"teleport <player>" teleports you to the location of another player', function (rest, player, game) {
  var destplayer = game.getPlayer(rest), destination;
  if (destplayer) {
    destination = destplayer.getCurrentRoom();
  } else {
    destination = game.rooms[rest];
  }
  if (destination) {
    player.getCurrentRoom().broadcast(player.name + ' disappears in a flash of science');
    player.setCurrentRoom(destination);
    player.getCurrentRoom().broadcast(player.name + ' appears in a flash of science');
    player.execute('look');
  } else {
    player.write("Can't find that player");
  }
});

command('say', "Say something to whoever is in the current room", function (rest, player, game) {
  player.getCurrentRoom().broadcast(player.name + ' says: ' + rest.trim(), player);
  player.write('You say: ' + rest.trim());
  game.emit('playerTalk', player, rest);
});

command('shout', "Say something so loud that all connected players can hear", function (rest, player, game) {
  game.broadcast(player.name + ' shouts: ' + rest);
});

command('list', "List all players in the game.", function (rest, player, game) {
  var list = "Players: ";

  _.each(game.players, function (pl) { list += pl.name + ", "; });

  player.write(list.substring(0,list.length-2));
});

command('look', 'Get a list of people and items in the current room or get a description of a person or item.', function (rest, player, game) {
  var room = player.getCurrentRoom();
  if (rest == '') {
    // Look at the current room
    player.write(room.description);
    _.map(room.getPlayers(), function (p) {
      if (player.name !== p.name) {
        player.write(p.name + ' is here');
      };
    });
    // Show all items in the room
    _.map(room.items, function(item) {
          player.write((item.short || item.name) + ' is here');
    });
    player.execute('exits');
  } else {
    // Maybe we want to look at an item in the room or in the player's inventory
    var item = player.getItem(rest) || room.getItem(rest);
    if (item) {
      player.write(item.description || item.short || item.name);
    } else {
      var otherPlayer = room.getPlayer(rest);
      if (otherPlayer) {
        player.write(otherPlayer.name + ' is ' + (otherPlayer.description || 'kind of generic looking'));
      } else {
        player.write("I don't know how to look at that");
      }
    }
  }
});

command('iam', 'Change the description provided when someone looks at you.', function (rest, player, game) {
  player.description = rest;
});

command('tell', function (rest, player, game) {
  function privateMessage(from, to, msg) {
    from.write('You tell ' + to.name + ': ' + msg);
    to.write(from.name + ' tells you: ' + msg);
  }

  function getPlayer(playerName) {
    if (!playerName) {
      return null;
    }
    var rtn = _.filter(game.players, function (player) {
      return player && player.name && player.name.toLowerCase() === playerName.toLowerCase();
    });
    return rtn.length > 0 ? rtn[0] : null;
  }

  var to     = rest.trim().split(' ');
  var msg    = rest.trim().substring(to[0].length+1);
  var target = getPlayer(to[0]);

  if (target) {
    privateMessage(player, target, msg);
  } else {
    player.write('No player connected with that name.');
  }
});

// When a  player (or NPC) enters a room announce them
handler('enterRoom', function (player, room, game) {
  room.broadcast(player.name + ' enters the room', player);
  player.display.reset();
  if (room.image) {
    player.display.show(room.image, 'room', {width: "100%", height: "100%"});
  }
  game.emitEvent("enterRoom", player.name, player, room);
});

// When a  player (or NPC) leaves a room announce that as well
handler('leaveRoom', function (player, room, game) {
  room.broadcast(player.name + ' leaves the room', player);
});

//
handler('get:*', function (game, player, item) {
  // remove item from room & add to player inventory
  var itemName = item.name;
  player.write("You pick up the " + itemName);
  player.getCurrentRoom().broadcast(player.name + ' picks up the ' + itemName, player);
  player.getCurrentRoom().items = _.without(player.getCurrentRoom().items, item);
  player.inventory.push(item);
});

handler("drop:*", function (game, player, item) {
  // remove item from player inventory & add to current room
  var rest = item.name;
  player.write("You drop the " + rest);
  player.getCurrentRoom().broadcast(player.name + ' drops the ' + rest, player);
  player.inventory = _.without(player.inventory, item);
  player.getCurrentRoom().items.push(item);
});
