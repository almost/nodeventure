room("The Cellar", {
  description: "You have fallen into the cellar. Above you is the hatch. You can not climb out.",
  exits: {
  }
});

item("The Cellar", "ladder",{
  image: '/files/ladder.jpeg',
  short: 'A ladder',
  respawnTime: 120,
  description: "an old wooden ladder"
});

itemCommand("climb", "ladder", "Hang on. I think I can climb that thing", (rest, player, item, game) => {
    player.setCurrentRoom('The Hop Poles');
    player.execute('look');
});

var goblin = character("The beer goblin", {
    location: "The Cellar",
    description: "a small shrivelled creature. Looks like he's been here a long time"
});

handler('enterRoom:The Cellar', function (player, room, game) {
    setTimeout(() => {
        goblin.execute('say welcome traveller. Do you want to play a game?');
    }, 3000);
});