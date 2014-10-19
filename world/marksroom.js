room('marksroom', {
  description: "You find yourself in an immaculately-decorated Louis XVI bedroom. The room is lit by illuminated floor tiles. In the centre of the room stands a tall, black monolith",
  exits: { 
  	north: 'home'
  },
  items: [
    {
      name: 'monolith',
      short: 'a monolith',
      description: 'A looming, black monolith, 1ft x 4ft x 9ft',
      gettable: false
    }
  ]
});

for(name in ["use","push","take","pick up"]){
	handler(name+":monolith",function(game,player,item){
		player.broadcast("The monolith falls over, unimpressively.");
	});
}
