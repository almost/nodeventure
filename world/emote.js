command('emote', 'show some emotion', function (rest, player, game) {
  player.broadcast(player.name + " " + rest);
  player.write("you " + rest);
});
