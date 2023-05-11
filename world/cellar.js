room('The Cellar', {
  description:
    'You have fallen into the cellar. Above you is the hatch. You can not climb out.',
  exits: {},
});

item('The Cellar', 'ladder', {
  image: '/files/ladder.jpeg',
  short: 'A ladder',
  respawnTime: 120,
  description: 'an old wooden ladder',
});

itemCommand(
  'climb',
  'ladder',
  'Hang on. I think I can climb that thing',
  (rest, player, item, game) => {
    player.setCurrentRoom('The Hop Poles');
    player.execute('look');
  }
);

var goblin = character('The beer goblin', {
  location: 'The Cellar',
  description:
    "a small shrivelled creature. Looks like he's been here a long time",
});

handler('enterRoom:The Cellar', function (player, room, game) {
  game.goblinState = game.goblinState || {};
  setTimeout(() => {
    game.goblinState[player.name] = updateGoblinState(0, player);
  }, 3000);
});

handler('playerTalk', (player, message, game) => {
  if(!player.npc) {
      game.goblinState = game.goblinState || {};
    console.log('goblinState after', game.goblinState);
    game.goblinState = updateGoblinState(game.goblinState, player, message);
    console.log('goblinState after', game.goblinState);
  }
});

function updateGoblinState(current = 0, player, message) {
    console.log('goblin', current, player, message);
  switch (current) {
    case 0: {
      goblin.execute(`say welcome ${player.name}. Do you want to play a game?`);
      return 1;
    }
    case 1: {
      if (message == 'no') {
        golbin.execute(`say too bad you're stuck here sucker`);
        goblin.execute('say do you want to play a game?');
        return 1;
      }

      if (message == 'yes') {
        golbin.execute('say I can be cracked, made, told, and played.');
        goblin.execute('say What am I?');
        return 3;
      }

      goblin.execute('say just say "yes" or "no" like a normal person');
      return 1;
    }
    case 3: {
      if (message.includes('egg')) {
        goblin.execute('say correct answer you can go now');
        player.inventory.push({
          name: 'ladder',
          short: 'A ladder',
          description: 'an old wooden ladder',
        });
        return 0;
      }

      goblin.execute("say wrong answer looks like you're stuck here forever");
      goblin.execute('say do you want to play a game?');
      return 1;
    }
  }
}
