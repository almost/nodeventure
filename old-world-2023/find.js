command('find', 'find out where an item is is: e.g. "find map', (rest, player, game) => {
    console.log('finding!');
    const name = rest.trim().toLowerCase();
    _.values(game.rooms).forEach(r => {
        const item = _.find(r.items, item => 
            (item.name && item.name.toLowerCase() === name) || (item.short && item.short.toLowerCase() === name)
        );
        if (item) {
            player.write(`${item.name} is in ${r.id}`)   
        }
    });
});

const listRooms = (player, game) => {
    const roomNames = Object.values(game.rooms)
        .map(r => r.id)
        .sort()
    player.write(`Rooms: ${roomNames.join(', ')}`)
};
const listItems = (player, game) => {
    const itemNames = Object.values(game.rooms)
        .flatMap(r => r.items)
        .map(i => i.name)
        .sort()

    player.write(`Items: ${itemNames.join(', ')}`);
};
const listPlayers = (player, game) => {
    
};
command('ls', 'List! All! The! Things!', (rest, player, game) => {
    const what = rest.trim().toLowerCase();
    switch (what) {
        case "rooms":
            listRooms(player, game)
            break
        case "items":
            listItems(player, game)
            break
        case "players":
            listPlayers(player, game)
            break
        case "exits":
            player.execute("exits")
            break
        default:
            player.write("Not sure what you mean")
    }
});