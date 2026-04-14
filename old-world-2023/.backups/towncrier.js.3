// An example of creating an NPC character. Internally these are mostly just 
// treated like players. So to get them to do stuff we can call .execute() to 
// have them execute a command just like a plyer would

const towncrier = character("The town crier", {
    location: "home",
    description: "looking nothing like a town and isn't crying. He's wearing a badge that says 'ask me about the skiff'"
});

// Let's make the town crier do stuff
handler("tick", () => {
   // A tick happens once a second, but we only want to do something every 30 seconds or so
   if (Math.random() < 0.03) {
       towncrier.execute("say Hear ye hear ye! This game needs some more things added to it! (hint: that's your job)");
       // Leave via a random exit
       const room = towncrier.getCurrentRoom();
       const exits = Object.keys(room.exits);
       if (exits.length === 0) {
           // stuck in a room without exits
           towncrier.execute("teleport home");
       } else {
           // Pick a random exit
           const exit = exits[Math.floor(Math.random()*exits.length)];
           towncrier.execute("go " + exit);
       }
   }
});

//We can handle playerTalk to have a character respond to a player
handler("playerTalk", (player, message) => {
    console.log("playerTalk")
    // First we check that the player is in the same room as the town crier and the "player" is not the town crier
    if (player.getCurrentRoom() === towncrier.getCurrentRoom() && player !== towncrier) {
        // Did they mention the skiff?
        if (/the skiff/i.exec(message)) {
            towncrier.execute("say The Skiff is a great co-working space if you need somewhere to work away from home. Come check us out at theskiff.org")
        }
    }
})