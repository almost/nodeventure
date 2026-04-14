room('semsroom', {
  description: "Welcome to Sem's room. This is the place to get some space...",
  exits: {
    north: 'garden',
    west: 'basment',
    east: 'river',
    south: 'kitchen',
    down: 'dungeon669'
  },
  image: 'myroom.jpg'
});

item('semsroom', 'secretWeapon', {
  image: '/cat.gif',
  respawnTime: 120,
  short: 'Catman',
  description: 'The cat is back.'
});

command('runme', 'Take a walk',function (rest, player, game) {
  for (let i = 0; i <= 20; i++) {
    game.execute(player, "random");
    game.execute(player, `shout ${i}`);
  }
} );

command('voice', '?',function (rest, player, game) {
  game.execute(player, "shout whhhat");
});


