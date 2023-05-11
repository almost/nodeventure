room("mall", {
  description: "a red guy looks at you he's waiting for(e) some money",
  exits: {
    south: "Middle Street"
  }
})

const darth = character("DarthAtTheMall", {
    location: "mall",
    description: "seems to be wearing all red, is he trying to emulate a roulette chip?"
})

handler("tick", () => {
   // A tick happens once a second, but we only want to do something every 30 seconds or so
   if (Math.random() < 0.03)
   {
       rand = Math.random();
       if (rand < 0.1)
           darth.broadcast("What happens in Dagobah stays in Dagobah")
       else if (rand < 0.2)
           darth.broadcast("Darth is in half")
       else if (rand < 0.3)
           darth.broadcast("I do not resemble a Ferrero Rocher")
       else if (rand < 0.4)
           darth.broadcast("Balenciaga shot first")
       else if (rand < 0.5)
           darth.broadcast("Hold on a sec, Jar Jar's ordering a Hawaiian")
       else
           darth.broadcast("Oi, got a power converter!?")
   }
})
