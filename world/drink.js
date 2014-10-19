command('drink', 'Drink something', function (itemName, player, game) {
  var item = _.find(player.inventory, function (it) {
    return itemName === it.name;
  });
  item = item || player.getCurrentRoom().getItem(itemName);
  if (item) {
    player.getCurrentRoom().broadcast(player.name + "tries to drink the " + itemName);
    player.write("You try to drink the " + itemName);
    if (itemName == 'prune juice') {
      player.getCurrentRoom().broadcast(player.name + " spits out the prune juice in disgust");
      player.write("You spit out the prune juice in disgust");
      item.description = item.description + "\nIt has previously been spat out by " + player.name;
    }
  } else {
    player.write("The " + itemName + " is not in your inventory.");
  }
});
