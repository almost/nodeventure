
room('tenforward', {
description: "You are in Ten Forward. Please drink responsibly",
exits: { north: 'sickbay', west:'home' },
items: [
   {
    name: 'prune juice',
    short: 'Worf\'s prune juice',
    description: 'A nice glass of prune juice',
    respawnTimer: 60
  }
]
});
