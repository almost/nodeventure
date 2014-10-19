
room('tenforward', {
description: "You are in Ten Forward. Please drink responsibly",
exits: { north: 'sickbay' },
items: [
   {
    name: 'prune juice',
    short: 'Worf\'s prune juice',
    description: 'A nice glass of prune juice',
    respawnTimer: 60
  }
]
});

handler("drink:prune juice", function (game, player, item) {
var rest = item.name;
player.write("You drink the " + rest + " and it tastes horrible");
player.getCurrentRoom().broadcast(player.name + ' drinks the ' + rest + " and convulses", player);
player.getCurrentRoom().broadcast("Worf slays" + player.name + "with his bat\'leth. Dishonour on your house");
player.inventory = _.without(player.inventory, item);
game.emit("invdrop:"+item.name, rest, player, game);
preventDefault();
});
