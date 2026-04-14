room("susanna's happy place", {
  description: "It's pretty zen in here with some lovely lighting. Everybody here is happy and calm and peaceful. A sense of peace comes over you, and you don't know why. You feel like you might finally be ready to make your peace with the universe. You can forgive yourself for all your sins. You can make peace and are at one with everything.",
  exits: {
    west: "beachbar"
  }
});

item("susanna's happy place", "a zen room",{
  image: '/files/susanna.png',
  short: 'a zen room',
  respawnTime: 1,
  description: "A relaxing, modernist room with chilled lighting"
});

item("susanna's happy place", "zen_garden", {
   image:  '/files/sand_garden.png',
   short: "zen_garden",
   respawnTime: 1,
   description: "We are nothing but dust so just enjoy"
});

// const key = item("susanna's happy place", "key",  {
//     short: "key",
//     respawnTime: 1,
//     description: "Might open something"
// });

itemCommand('rake','zen_garden', function (rest, player, item, game) {
    player.write(player.name + ' has raked the sand peacefully');
    
    const prizes = ["a lovely key", "Olly's soul", "a massive ruby", "their hopes and dreams", "a sheep", "assorted lint", "coffee"];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    player.write(player.name + ' has found ' + prize + ' and may it bring them good luck!');
    // player.write(player.name + ' has found key');
    // player.receive(player, key);
});

// handler('tick', () => {
//     console.log(Object.keys(game.commands))
// })

command('where', 'find out where a player is: e.g. "where myMate', (rest, player, game) => {
    console.log('finding!');
    const playerToFind = game.players[rest.trim()];
    if (!playerToFind) {
        player.write(`Could not find ${rest}`);
    }
    player.write(`${rest} is at location: ${playerToFind.location}`);
})