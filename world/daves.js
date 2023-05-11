room("beach", {
  description: "You are on a beach. It's nice and sunny here.",
  exits: {
    north: "home2",
    south: "beachbar",
  }
});

room("beachbar", {
  description: "You are in a chill tropical beach bar.",
  exits: {
    north: "beach",
    east: "susanna's happy place",
    south: "First Jedi Temple"
  }
});

item("beach", "sea", {
  short: 'the sea',
  respawnTime: 120,
  description: "it's big and wobbly and blue"
});

item("beachbar", "margaritas", {
  short: 'many margaritas',
  respawnTime: 120,
  description: "there are very many yet somehow too few"
});
