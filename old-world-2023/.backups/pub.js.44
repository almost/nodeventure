room("Middle Street", {
  description: "The middlest of all the streets. Do NOT leave your bikes here overnight, or they will get pinchy pinched.",
  exits: {
    "thehoppoles": "The Hop Poles",
    "portal": "home"
  }
})

room("The Hop Poles", {
  description: "You are in a busy pub in the lanes. There's beer everywhere. Through the back exit you can see a small crowd of nerds sat at a table.",
  exits: {
    "frontdoor": "Middle Street",
    "backdoor": "Beer Garden"
  }
});

item("The Hop Poles", "table",{
  image: '/files/table.jpeg',
  short: 'A table',
  respawnTime: 120,
  description: "a big table around which various people are seated with their laptops"
});

item("The Hop Poles", "chair", {
    image: '/files/chair.jpg',
    description: "This is a chair",
    short: 'A chair',
    respwnTime: 120,
});

const beerGarden = room("Beer Garden", {
  description: "The beer garden is almost empty bar a small group of NERDS. One of the NEEEERDS is complaining about the price of a delicious IPA.",
  exits: {
    "backdoor": "The Hop Poles" 
  }
});

item("The Hop Poles", "Beer", {
    description: "An ice cold beer",
    image: "",
});

itemCommand("drink", "Beer", "Delicious", (rest, player, item, game) => {
    const room = player.getCurrentRoom();
    room.broadcast(player.name + " sits on the chair, they are in the " + room.name);
    player.postion = "sitting";
    
});

item("Beer Garden", "remi", {
  description: "A short man with a cigarette in his mouth and a Pravha in his hand.",
  image: ""
});

const pokeRemi = (_1,_2,_3,game) => {
  game.remiCount = (game.remiCount ?? 0) + 1;
  
  item("Beer Garden", `remi${game.remiCount}`, {
    description: "Another short man with a cigarette in his mouth and a Pravha in his hand."
  });
  
  beerGarden.broadcast(`A wild remi appeared. There are now ${game.remiCount} remis smoking cigarettes in the beer garden.`)
  
  for (let i = 0; i < game.remiCount; i += 1) {
    itemCommand("poke", `remi${game.remiCount + 1}`, pokeRemi);
  }
};

itemCommand("poke", "remi", pokeRemi);