# Object types

Rooms, items, players, and the game itself are represented as objects. You
get references to them through the arguments to your callbacks. The methods
and properties below are what you can use on each.

## Room

Wherever you have a `room` reference:

### Properties

 - `id` - The room's id.
 - `description` - Shown by `look`.
 - `image` - URL displayed in the player's display pane.
 - `exits` - `{ direction: roomId, ... }`.
 - `items` - Items currently in the room.
 - `color` - Room colour, used by the built-in `enterRoom` handler.
 - `display` - The room's `Display` (see below).

### room.broadcast(message, exceptPlayer)

Broadcast a `message` to all players in the room. Optionally exclude one
player (often the one who triggered the message). Example:

    room.broadcast("Hey everybody!");
    room.broadcast(`${player.name} waves.`, player);

### room.getExit(direction)

Returns the neighbouring `Room`, or `undefined`.

### room.getPlayers()

Returns an array of players currently in the room.

### room.getPlayer(name)

Returns a specific player in the room, or `undefined`.

### room.getItem(query)

Returns an item in the room matching `query` (id, name, or short), or
`undefined`.

## Item

Items have whatever properties you set in `item(...)`, plus always:

 - `id` - The item id.
 - `name` - What players type to refer to it.

Custom properties survive — if you said `item("key", { unlocks: "chest" })`,
then `item.unlocks` will be `"chest"` later.

## Player

Wherever you have a `player` reference:

### Properties

 - `name` - Their name.
 - `location` - The id of the room they're in.
 - `inventory` - Array of items they're carrying.
 - `npc` - `true` for characters created with `character()`.
 - `display` - Their `Display` (see below).

You can stick custom properties on players (`player.score = (player.score ||
0) + 1`) and they survive code reloads.

### player.write(message)

Write a `message` to the player's browser. Example:

    player.write("Hey player!");

### player.broadcast(message)

Broadcast a `message` to all players in the same room as `player`, except
`player` themselves. Example:

    player.broadcast("Hey everybody!");

### player.execute(command)

Execute a `command` on behalf of the `player`, as if they typed it.

### player.getCurrentRoom()

Returns the `Room` the player is currently in.

### player.setCurrentRoom(idOrRoom)

Move the player to another room. Fires `leaveRoom`, `enterRoom`, and the
appropriate `roomTransition` event.

### player.getItem(query)

Returns an item from the player's inventory, or `undefined` if not present.

### player.receive(giver, item)

Hand the player an item. If the player has an `onReceive` method, it's
called.

## Game

The singleton `game` object, passed into most commands and handlers.

### Properties

 - `rooms` - `{ roomId: Room }`.
 - `items` - `{ itemId: Item }`.
 - `players` - `{ name: Player }`.
 - `commands` - `{ commandName: fn }`.
 - `display` - The world-wide `Display`.

### game.broadcast(message)

Broadcast a `message` to every connected player.

    game.broadcast("Hey everybody!");

### game.warn(message)

Broadcast a warning. Shown styled in players' browsers.

    game.warn("Something almost went wrong.");

### game.error(message)

Broadcast an error. Shown more emphatically.

    game.error("Something actually went wrong.");

### game.getPlayer(name)

Returns the named `Player`, or `undefined`.

### game.execute(player, command)

Execute a `command` on behalf of a player.

    game.execute(somePlayer, "say hi");

### game.emit(name, ...args)

Emit an event. Most useful for triggering your own custom events.

## Display

The right-hand panel in each player's browser. `player.display` targets one
player; `room.display` targets everyone in the room; `game.display` targets
everyone.

### display.show(imageUrl, id, style)

Show an image. `id` lets you replace or clear it later. `style` is an object
of CSS properties (e.g. `{ width: "100%", height: "100%" }`). Pass
`undefined` for `imageUrl` to clear by id.

    player.display.show(
      "https://example.com/letter.jpg",
      "letter",
      { width: "100%", height: "100%" }
    );

### display.reset()

Wipe the display.

### display.draw(id, items)

Quick canvas of labelled boxes — used by the `see` command in the built-in
world.

### display.eval(codeOrFn, vars)

Run JS in the display pane. `codeOrFn` can be a string or a function.
