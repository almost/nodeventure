# Welcome!

You can change the game while it's running. Add new rooms, drop items into
them, invent commands, make the lights flash — it all happens in the editor.

## How to make a code file

1. Click the **Code** tab at the top.
2. Hit **+ New File**.
3. Give it a name ending in `.js` — say, `garden.js`.
4. Paste in something from below.
5. Save. Your changes are live straight away.

If you mess something up, only your file breaks — the rest of the game
keeps running. Open the file's **log** tab to see errors and anything you
print with `console.log`.

## Try these

### A new room

Adds a garden, with a way back to `home`.

    room("garden", {
      description: "A small walled garden. Bees hum over the lavender.",
      exits: { north: "home" }
    });

That gives you a `north` exit *out of* the garden, but nothing pointing
*into* it yet. Open the **Rooms** tab, pick `home`, and add a `south` exit
to `garden` — saving from the editor wires up the matching exit on the
other room for you. Then in the game, type `south` from home to walk in.

### An item to pick up

    item("banana", {
      name: "banana",
      short: "a slightly bruised banana",
      description: "Yellow and a bit soft."
    });

    spawn("garden", "banana", { spawnSeconds: 30 });

Now bananas appear in the garden every 30 seconds. Pick one up with `get
banana`, drop it again with `drop banana`.

### A new command

    command("wave", "Wave at someone, or no-one.", (rest, player) => {
      if (rest) {
        player.write(`You wave at ${rest}.`);
        player.broadcast(`${player.name} waves at ${rest}.`);
      } else {
        player.write("You wave.");
        player.broadcast(`${player.name} waves.`);
      }
    });

Type `wave` or `wave dave` in the game.

### Give a room its own colour

Set `color` on a room and the LED strip (and the page header in the
browser) fades to match whenever a player walks in. No handler needed —
that bit's built in.

    room("kitchen",    { description: "Tiles, a sink.", color: "orange"  });
    room("cellar",     { description: "It's dark.",     color: "#220044" });
    room("greenhouse", { description: "Warm and damp.", color: "green"   });

Colours can be a CSS name like `"red"` or `"orange"`, a hex like `"#220044"`,
or `[r, g, b]`. You can also set the colour from the **Rooms** editor
without writing any JS.

### A torch

A pickupable torch you can light and snuff.

    item("torch", { name: "torch", short: "a brass torch" });
    spawn("garden", "torch", { spawnSeconds: 60 });

    itemCommand("light", "torch", "Light the torch.", (rest, player) => {
      player.write("The torch flares to life.");
      player.broadcast(`${player.name} lights a torch.`);
      lights("#ff8800", null, 400);
    });

    itemCommand("snuff", "torch", "Snuff the torch.", (rest, player) => {
      player.write("Darkness.");
      player.broadcast(`${player.name} snuffs the torch.`);
      lights("#000000", null, 800);
    });

### An NPC

A cat called Ada who occasionally meows, can be petted, and recognises her
name when people talk — though she pretends she doesn't.

`character()` returns the new NPC, so we hang on to it in `ada` and use
that everywhere instead of looking her up each time.

    const ada = character("ada", {
      location: "kitchen",
      description: "A small black cat with green eyes."
    });

    // Every second, small chance she meows out loud in her room.
    handler("tick", () => {
      if (Math.random() < 0.01) {
        ada.broadcast("Ada meows.");
      }
    });

    // A custom "pet ada" command. Only works when you're in the same room.
    command("pet", "Pet a creature. Try `pet ada`.", (rest, player) => {
      const target = rest.trim().toLowerCase();
      if (target !== "ada" || ada.location !== player.location) {
        player.write("There's nothing of that name here to pet.");
        return;
      }
      player.write("You scritch Ada behind the ears. She purrs.");
      player.broadcast(`${player.name} pets Ada. She purrs loudly.`);
    });

    // When anyone says her name, she notices — and then very deliberately
    // ignores it, in the way only a cat can.
    handler("playerTalk", (player, message) => {
      if (!/\bada\b/i.test(message)) return;
      if (ada.location !== player.location) return;
      ada.broadcast("Ada's ears twitch. She looks up, blinks slowly, and goes back to washing her paw.");
    });

### A character that wanders

Rover the dog wanders the world by picking a random exit every so often.
Players already in the room will see "Rover leaves the room" and the room
he wanders into will see "Rover enters the room" — that's the built-in
leave/enter announcements doing the work for you.

    const rover = character("rover", {
      location: "home",
      description: "A scruffy dog with a wagging tail."
    });

    handler("tick", () => {
      // ~5% chance per second.
      if (Math.random() > 0.05) return;
      const exits = Object.keys(rover.getCurrentRoom().exits);
      if (exits.length === 0) return;
      const direction = exits[Math.floor(Math.random() * exits.length)];
      rover.execute(`go ${direction}`);
    });

## Where to go next

- [world-modules.md](world-modules.md) — how the editor and saved files work
- [globals.md](globals.md) — the full list of things you can call: `room`, `item`, `command`, `lights`, …
- [events.md](events.md) — events you can react to (when a player enters a room, says something, etc.)
- [objects.md](objects.md) — what you can do with `player`, `room`, `item`, `game`
- [messages.md](messages.md) — fancier ways to send text and HTML
