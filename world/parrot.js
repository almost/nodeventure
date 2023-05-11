const parrot = character('Parrot', {
    location: 'home',
    description: 'It a birb'
});

const parrotify = (text, player, game) => {
    if (
        !player.name.toLowerCase().includes('parrot') &&
        Math.random() < 0.2 &&
        player.location === parrot.location
    ) {
        parrot.execute(`say BWAAAK! ${text} BWAAAK!`.toUpperCase());
    }
};

handler('command:say', parrotify);
handler('command:tell', parrotify);
handler('command:shout', parrotify);
