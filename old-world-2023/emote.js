command("emote", "Do an emote", (rest, player, game) => {
    player.write("You " + rest);
    player.broadcast(player.name + " " + rest)
});