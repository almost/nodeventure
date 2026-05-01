# Predefined events

The following event types are built in to Nodeventure. Use `handler()` (or
`event()` for the scoped variants) to listen for them.

## tick

Arguments: `[]`

A general-purpose event that fires every second.

## joinPlayer

Arguments: `[player, game]`

Fired whenever a new player joins the game.

## enterRoom

Arguments: `[player, room, game]`

Fired whenever a player enters a room.

## enterRoom:&lt;roomId&gt;

Arguments: `[player, room, game]`

The same event scoped to a single room id. Fires alongside the unscoped
`enterRoom`.

    event("enterRoom", "kitchen", (game, player, room) => {
      player.write("The toaster pings.");
    });

## leaveRoom

Arguments: `[player, room, game]`

Fired whenever a player leaves a room.

## leaveRoom:&lt;roomId&gt;

Arguments: `[player, room, game]`

The single-room scoped variant.

## roomTransition:&lt;from&gt;:&lt;to&gt;

Arguments: `[player, next, previous]`

Fired for a specific A→B move. Useful for one-way reactions like "the door
slams behind you".

## playerTalk

Arguments: `[player, message, game]`

Fired whenever a player uses the `say` command.

    handler("playerTalk", (player, message) => {
      if (/banana/i.test(message)) {
        player.broadcast("A distant monkey screeches.");
      }
    });

## command:&lt;commandName&gt;

Arguments: `[rest, player, game]`

Fired after a command runs.

## get:&lt;itemId&gt; / get:*

Arguments: `[game, player, item]`

Fired when a player tries to pick up an item. The item-specific event fires
first; if you don't call `preventDefault()`, the `get:*` fallback (the
default pick-up behaviour) runs after.

## drop:&lt;itemId&gt; / drop:*

Arguments: `[game, player, item]`

Same shape as `get`, but for dropping.

## spawn

Arguments: `[room, item]`

Fired when `spawn()` drops a fresh copy of an item into a room.

## all

Arguments: `[eventName, ...originalArgs]`

A meta-event that fires for *every* event. Useful for logging.

    handler("all", (name, ...args) => console.log("event:", name));
