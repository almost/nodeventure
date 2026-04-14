// An integer representing the number of ticks the server has cycled
let parslows = 0

// An object storing the number of go commands completed by each player
const playerParsecs = {}

// Increments Parslows on server tick
handler('tick', () => parslows++)

handler('enterRoom', (player) => {
    // Increments player's Parsecs when they enter a room
    playerParsecs[player.name] = playerParsecs[player.name] ? ++playerParsecs[player.name] : 1
})

command('check', 'Check stuff, such as the time on your watch', (rest, player, game) => {
    if (rest.includes('time')) {
        const message = `This universe has existed for ${parslows} Parslows`
        
        player.write(message)
        player.broadcast(`${player.name} checked the time. ${message}`)
    }
    
    if (rest.includes('distance')) {
        const message = `have travelled ${playerParsecs[player.name] || 0} Parsecs`
        
        player.write(`You ${message}`)
        player.broadcast(`${player.name} proudly announces they ${message}`)
    }
})
