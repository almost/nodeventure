# Defining things

The following functions are automatically available to every file in the
editor. Call a function to define a room, item, character, command, or event
handler.

## room(id, options)

Creates or updates a room in the game world. Returns a reference to a `Room`
object. Example:

    room("aRoom", {
      description: "You are standing in a room.",
      image: "http://example.com/room.jpg",
      exits: { west: "anotherRoom", east: "yetAnotherRoom" },
      color: "orange"
    });

Arguments:

 - `id` - Each room must have a unique string id. This lets you refer to the
   room from other rooms and from `spawn`.

 - `options` - An object containing options for the room:

    - `description` - A string description. Nodeventure prints this when the
      player types `look`.

    - `image` - An optional image URL displayed in the player's display pane
      while they're in the room.

    - `exits` - An object describing the exits from this room and the rooms
      they connect to. Keys are exit names; values are the string ids of the
      destination rooms. For example:

            { north: "castle", down: "cellar", skywards: "sky" }

      Exits defined in code are one-way. If you say a room exits `north` to
      `castle`, players can walk north out of it, but they can't walk back
      unless `castle` has its own `south` exit. The file's log will warn you
      when an inverse is missing. The **Rooms** editor *does* add the
      matching inverse exit for you when you save through it.

    - `color` - An optional colour (any format `lights()` accepts). The
      built-in `enterRoom` handler uses this to set the LEDs and the page
      header background as players walk in.

## item(id, options)

Creates an item *definition*. Items are global — once defined, you place
copies of them into rooms with `spawn()`, or pick them up via the `get`
command. Returns a reference to an `Item` object. Example:

    item("jetpack", {
      name: "jetpack",
      short: "a jetpack",
      description: "An awesome jetpack for flying around.",
      image: "http://example.com/jetpack.jpg",
      gettable: true
    });

Arguments:

 - `id` - A unique string id for the item.

 - `options` - An object containing the following options (all optional):

    - `name` - What players type to refer to the item. Defaults to the id.

    - `short` - A short (few-word) description used in room listings, e.g.
      "a jetpack is here".

    - `description` - A longer description shown when the player types
      `look <item>`.

    - `image` - An image URL shown by `look <item>`.

    - `gettable` - Set to `false` to prevent players picking the item up.
      Defaults to `true`.

You can also attach any custom properties — `item("key", { unlocks: "chest"
})` — and read them back later in handlers.

## spawn(roomId, itemId, options)

Periodically drops a copy of an item into a room. If a copy is already
there, the spawn is skipped. Example:

    spawn("kitchen", "banana", { spawnSeconds: 30 });

Arguments:

 - `roomId` - The id of the room to spawn into.

 - `itemId` - The id of the item to spawn.

 - `options` - Options:

    - `spawnSeconds` - Seconds between spawns. Defaults to 60.

## command(name, [helpText], callback)

Creates a new command that the player can type in.

 - `name` - The first word of the command, e.g. `"look"`. Nodeventure runs
   your callback when the player types a command starting with this word.

 - `helpText` (optional) - Help text shown by the `help` command.

 - `callback` - A function executed when the player types the command:

   `callback(rest, player, game)`

    - `rest` - The remainder of the command. For `"look at the room"`,
      `rest` is `"at the room"`.

    - `player` - The `Player` who typed it.

    - `game` - The global `Game` object.

Example:

    command("wave", "Wave at someone or no-one.", (rest, player, game) => {
      if (rest) {
        player.write(`You wave at ${rest}.`);
        player.broadcast(`${player.name} waves at ${rest}.`);
      } else {
        player.write("You wave.");
        player.broadcast(`${player.name} waves.`);
      }
    });

## itemCommand(name, itemName, [helpText], callback)

A variation of `command()` that defines a command relating to a particular
item. Only fires when the player has the item or is in a room containing it.

 - `name` - The first word, e.g. `"eat"`.

 - `itemName` - The second word, e.g. `"banana"`.

 - `helpText` (optional) - Help text shown by `help`.

 - `callback` - `callback(rest, player, item, game)`

    - `rest` - The remainder of the command.

    - `player` - The `Player` who typed it.

    - `item` - The `Item` they referred to.

    - `game` - The global `Game` object.

Example:

    itemCommand("eat", "banana", "Eat the banana.",
      (rest, player, item, game) => {
        player.write("You take a bite of the banana.");
        player.broadcast(`${player.name} takes a bite out of the banana.`);
      });

## character(name, options)

Creates an NPC — a player not connected to anyone. Returns the `Player`.

 - `name` - A globally unique string name.

 - `options` - An options object:

    - `location` - The id of the room they start in.

    - `description` - A description shown when someone looks at them.

    - Anything else you want — it'll be set as a property on the player.

Example:

    character("ada", {
      location: "kitchen",
      description: "A small black cat with green eyes."
    });

Use `handler("tick", ...)` to give the character behaviour.

## handler(eventName, callback)

Registers a handler for an event.

 - `eventName` - The event name. See [events.md](events.md) for the list.
   Pass `"all"` to listen for every event.

 - `callback` - Called whenever the event fires. Arguments depend on the
   event.

If your handler throws, it's caught, an error is broadcast, and the handler
is removed — so a buggy listener doesn't keep firing forever.

## event(name, subjectId, callback)

Sugar for `handler("name:subjectId", callback)`. Useful for reacting to
something happening to one specific room or item.

    event("enterRoom", "kitchen", (game, player, room) => {
      player.write("The toaster pings.");
    });

## preventDefault()

When the engine fires `verb:itemId` (e.g. `get:banana`) it follows up with a
fallback `verb:*`. Call `preventDefault()` inside a specific handler to skip
the fallback.

    event("get", "anvil", (game, player, item) => {
      player.write("It's far too heavy.");
      preventDefault();
    });

## setTimeout(callback, ms)

Like the browser's `setTimeout`. Errors thrown by `callback` are caught and
shown in the game instead of crashing things.

    setTimeout(() => game.broadcast("A bell tolls."), 60_000);

## lights(color, ledIndex, fadeMs)

Sets the LED strip — and the colour of the page header in everyone's
browser, even when no LEDs are plugged in.

 - `color` - A name (`"red"`), hex (`"#f80"` or `"#ff8800"`), `[r, g, b]`,
   or `{ r, g, b }`.

 - `ledIndex` - Which LED to set. Pass `null` or omit for the whole strip.

 - `fadeMs` - Optional fade duration in milliseconds. The header background
   fades to match.

Examples:

    lights("red");                    // whole strip red, instantly
    lights("#ff8800", 0);             // just LED 0, instantly
    lights([0, 200, 80], null, 1500); // whole strip, fade over 1.5s

### Room mood lighting

Just set `color` on a room — the built-in `enterRoom` handler will fade the
LEDs (and the page header) to match as players walk in. Colours can be a
CSS name (`"red"`, `"orange"`), a hex (`"#220044"`), or `[r, g, b]`.

    room("kitchen", { description: "...", color: "orange"  });
    room("cellar",  { description: "...", color: "#220044" });

### A torch item

    item("torch", { name: "torch", short: "a brass torch" });

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

### Alarm flash

    command("panic", "Sound the alarm.", (rest, player, game) => {
      game.broadcast(`${player.name} hits the panic button!`);
      let on = true;
      for (let i = 0; i < 10; i++) {
        setTimeout(() => lights(on ? "red" : "black"), i * 200);
        on = !on;
      }
    });

## game

A global reference to the `Game` object — the same one passed as the third
argument to `command()` callbacks. Useful in places where you don't get it
through arguments (like a top-level `setTimeout` or a `tick` handler).

    setTimeout(() => game.broadcast("A bell tolls."), 60_000);

    handler("tick", () => {
      if (Object.keys(game.players).length === 0) {
        // nothing to do
      }
    });

See [objects.md](objects.md) for what you can do with it.

## console.log(...)

Writes to the file's log tab in the editor. Handy for debugging.

## _

Underscore.js. Iteration over engine objects (`_.each(game.players, ...)`)
works reliably here even where plain `for...of` is awkward.
