room("olly", {
  description: "21:20 This is the place of ollynesssssssss",
  exits: {
    south: "home2",
    sky: "broom cupboard",
  }
});



item('olly', 'compass', {
    image: 'http://skyapperley.co.uk/nodeadventure/red-vial.png',
    respawnTime: 10,
    width:60,
    height:100,
    top:350,
    left:70 ,
    short: 'compass',
    description: 'map compasss to make a map'
  });

itemCommand('read','compass', 'See the map', function(rest, player, item, game){

   var map_url = "https://mermaid.ink/img/pako:eNqFVMGOmzAQ_RXLl15CBBhCQqUetqvdXipV3T017GHAkyVaYyNjuqVR_r0OKsGQRHvDzHtvZt6MfaCF4khTmsmdUO9FCdqQ53tCMhlsKxDihXheo1pTet4X0kqOu71Evv2-51wgeTIa0byQz4Rtc4SiPMGl0nN4qSoMZ7Arqn0sB31CRs7J0TwLzBEIjZmqNW0DUsKnhpRQ1x2pBRR4IsZ9PTdqOJc6oi6llRDdFFPbAkF8YNJqUHcaGiQm0cuMuVaqIkVb5wo0n8HfcQ43Gvhevv60pBn23LLjJAv_d-SEV87QnPBb91FdjF38HCt0VaO5QZ5nSixVXSuBzTTNc4nkm6rJj1PoFnucwWgqi-dcz9tpJQ1XSvc2RFeW-Qoph-Jt4Ix13SFq8mibRHmLWKAQ0NPCPvi1P_fo1ZQ_TXKpZRnJra0eLY4m14ith114EFbYBTombba_lbGYO6XM9HKeZ38NNaypA8okXdAKdQV7bp-VQybtW0LtXCvMaGo_rXPQCpPZF-doodAa9dTJgqZGt7igbc3B4P0eXjVUNN2BaOzfGiRND_QPTaNoGbIgiYJ1Eq83ScjiBe1oGvjBksUR8wO2ihIWs_i4oH_tFtLUX258tvb9TZT463gTBmGv96sPnpIe_wExpaIA?type=png"
    player.display.show(map_url);
});

itemCommand('map', 'compass', 'make a map with the compass', function(rest, player, item, game){
    player.write('Just mapping things out...');
    var mermaid_txt = "flowchart TD  \n";
    var ri = 0;
    var room_map = {};
    
    for (var r in game.rooms) {
         ri += 1;
         room_map[r] = ri
        
         player.write('map ' +room_map)
        // for (var e in r.exits) {
        //     // have r room and e exit
        //     mermaid_txt = mermaid_txt + r.id + ' --' ; //+ e.vaue() + '-->' + e.key() + '\n';
        // }
        // player.write('this ' + game.rooms[r].id)
        if (room_map[game.rooms[r].exits[e]] == null) {
            room_map[game.rooms[r].exits[e]] = ri;
            ri += 1;
        }
        for (var e in game.rooms[r].exits) {
           
            // player.write('exits ' + e + game.rooms[r].exits[e])
            // player.write('exists ' + e)
            
            if (r.startsWith("moon")) {
                 // no mapping you!
            } else {
            // if (game.rooms[r].exits[e].includes())
                player.write('Exit number '+ room_map[game.rooms[r].exits[e]])
                var exit_room = room_map[game.rooms[r].exits[e]] + '['+game.rooms[r].exits[e]+']'
                
                
                mermaid_txt = mermaid_txt + room_map[r] + '['+r +']'+ ' --' + e +'--> ' + exit_room + ' ; ' //+ ' --> ' + game.rooms[r].exits[e])
            }
        }
      }
      
    player.write('This is it so far \n' + mermaid_txt)
    
    // player.display.addScript()
    // player.display.eval()

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
