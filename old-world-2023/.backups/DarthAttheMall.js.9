room("DarthAtTheMall", {
  description: "a red guy looks at you he's waiting for(e) some money",
  exits: {
    south: "down to the sea"
  }
});

const darth = character("DarthAtTheMall", {
    location: "mall",
    description: "seeems to be wearing all red, is he trying to emulate a roulette chip"
});

// Let's make the town crier do stuff
handler("tick", () => {
   // A tick happens once a second, but we only want to do something every 30 seconds or so
   if (Math.random() < 0.03)
   {
       rand = Math.random();
       if (rand < 0.1)
           darth.execute("what happens in dagobah stays in dagobah)");
       else if (rand < 0.2)
           darth.execute("Darth is in half");
       else if (rand < 0.3)
           darth.execute("I do not resemble a Ferrero Rocher");
       else if (rand < 0.4)
           darth.execute("Balenciaga shot first");
       else if (rand < 0.5)
           darth.execute("hold on a sec, Jar Jar's ordering a Hawaiian");
       else
           darth.execute("oi got a power converter");
       
       
       // Leave via a random exit
       const room = darth.getCurrentRoom();
       const exits = Object.keys(room.exits);
       if (exits.length === 0) {
           // stuck in a room without exits
           darth.execute("teleport home");
       } else {
           // Pick a random exit
           const exit = exits[Math.floor(Math.random()*exits.length)];
           darth.execute("go " + exit);
       }
   }
});

//We can handle playerTalk to have a character respond to a player
handler("playerTalk", (player, message) => {
    // First we check that the player is in the same room as the town crier and the "player" is not the town crier
    if (player.getCurrentRoom() === darth.getCurrentRoom() && player !== darth) {
        // Did they mention the skiff?
        if (/the skiff/i.exec(message)) {
            darth.execute("say The Skiff is a great co-working space if you need somewhere to work away from home. Come check us out at theskiff.org")
        }
    }
})