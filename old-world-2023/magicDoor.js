// This module was breaking moving between rooms so I have disabled -Tom
//
// const goCommand = (rest, player, game) => {
//     const roomIds = Object.keys(game.rooms);
//     const id = roomIds[Math.floor(Math.random() * roomIds.length)];
//     const destination = game.rooms[id];
//     player.setCurrentRoom(destination);
//     // console.log(`we've transported ${player.name} to ${id}`)
//     player.execute('look');
// };
// command('random', goCommand)
// 'nsew'.split('').forEach(d => command(d, goCommand))
// command('go', goCommand)
