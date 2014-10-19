room('home', {
  description: "You are in the captains quarters room at BarCamp Machester 5. Where to now?",
  exits: { west: 'beige', east: 'tenforward' },
  items: [
    {
      name: 'door',
      short: 'a locked wooden door',
      description: 'There is an intriguing wooden door with no handle on the north wall',
      gettable : false
    }
  ]
});
