room("olly", {
  description: "This is the place of ollynesssssssss",
  exits: {
    south: "home2",
    sky: "broom cupboard",
  }
});


item("olly", "banna",{
  image: '/files/banna.jpg',
  short: 'a yellow thing',
  respawnTime: 120,
  description: "Is it a fruit or is it a seed?? Or something completely differnet...? #factcheck"
});


// broom cupboard
item("broom cupboard", "banna",{
  image: '/files/banna.jpg',
  short: 'a yellow thing',
  respawnTime: 120,
  description: "Is it a fruit or is it a seed?? Or something completely differnet...? #factcheck"
});



item("olly", "chair",{
  image: '/files/table.jpeg',
  short: 'the chair',
  respawnTime: 120,
  description: "monkey chairs"
});

item('olly', 'dice', {
  description: 'A die with 20 whole sides.',
  respawnTime: 20,
  short: 'a 20 sided die',
});

itemCommand('roll', 'dice', function (rest, player, item, game) {
  var number = Math.ceil(Math.random() * 20);

  if (number < 10) {
    player.write('You roll a ' + number);
    player.getCurrentRoom().broadcast(player.name + ' rolls a ' + number + ' with their d20.');
  } else {
    player.display.show('http://gifrific.com/wp-content/uploads/2013/02/Sea-Turtle-High-Five.gif', 'd20');
    player.write('You roll over 10 happy days!');
    player.getCurrentRoom().broadcast(player.name + ' wins. ' + number + ' has been rolled. Game over');
  }

  console.log(player.display.show);
});
