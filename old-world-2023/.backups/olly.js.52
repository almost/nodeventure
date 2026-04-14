room("olly", {
  description: "This is the place of ollynesssssssss",
  exits: {
    south: "home2",
    sky: "broom cupboard",
  }
});


// item("olly", "banna",{
//   image: '/files/banna.jpg',
//   short: 'a yellow thing',
//   respawnTime: 120,
//   description: "Is it a fruit or is it a seed?? Or something completely differnet...? #factcheck"
// });


// broom cupboard
b1 = {
  image: '/files/banna.jpg',
  short: 'banna - a yellow thing',
  respawnTime: 120,
  description: "Is it a fruit or is it a seed?? Or something completely differnet...? #factcheck"
}


item("broom cupboard", "banna", b1);
item("olly", "banna", b1);



itemCommand('eat','banna', function (rest, player, item, game) {
    
    player.write(player.name + ' has become a banna');
    var number = Math.ceil(Math.random() * 20);
const here = player.getCurrentRoom();
  if (number < 10) {
        player.write('You are in room '+ here.name + ' and where luck');   
  }
  
   player.write(here.name);
  here.broadcast('Bannnnnnnnnnnnnaaaaaaassssss!')
   for (let i = 0; i < 5; i++) {
       here.items.push(b1);
   }
   for (let r in game.rooms) {
       game.rooms[r].items.push(b1)
       game.rooms[r].broadcast('Banna\'s have arrived - and beer an pizza to eat...')
   }
   
   for (let p in game.players) {
    //   game.player[p].items.push(b1);
       player.write(p)
    //   game.player[p].write('Your a banna!');
       //game.rooms[r].broadcast('Banna\'s have arrived - and beer an pizza to eat...')
   }
  console.log(player.display.show);
});

item("olly", "chair",{
  image: '/files/table.jpeg',
  short: 'the chair',
  respawnTime: 120,
  description: "monkey chairs"
});

dice_obj = {
  description: 'A die with 20 whole sides.',
  respawnTime: 20,
  short: 'a 20 sided die',
}
item('olly', 'dice', dice_obj);

itemCommand('roll', 'dice', function (rest, player, item, game) {
  var number = Math.ceil(Math.random() * 20);

  if (number < 10) {
    player.write('You roll a ' + number);
    player.getCurrentRoom().broadcast(player.name + ' rolls a ' + number + ' with their d20.');
    for (let r in game.rooms) {
       game.rooms[r].items.push(dice_obj)
       game.rooms[r].broadcast('It\'s all in the roll of the dice')
   }
  } else {
    player.display.show('http://gifrific.com/wp-content/uploads/2013/02/Sea-Turtle-High-Five.gif', 'dice');
    player.write('You roll over 10 happy days!');
    player.getCurrentRoom().broadcast(player.name + ' wins. ' + number + ' has been rolled. Game over');
  }

  console.log(player.display.show);
});
