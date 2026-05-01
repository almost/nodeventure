# Code files

Each file you create in the editor is its own little script. It runs once
when you save it, and registers any rooms, items, commands, or handlers it
defines.

## Hello room

    room("garden", {
      description: "A small walled garden. A rusted gate leads north.",
      exits: { north: "home" }
    });

Save in the editor — it loads immediately. Walk in by typing `north` (or
whatever direction you wired up).

## What you get

- The functions listed in [globals.md](globals.md) — `room`, `item`,
  `command`, and friends.
- `console.log(...)` — output goes to the file's log tab in the editor.
- `_` — Underscore.js, useful for `_.each`, `_.without`, `_.keys`.
- Standard JS: `Math`, `JSON`, `Date`, `Promise`, `Map`, `Set`, …

## What you don't get

No `require`, `process`, `Buffer`, `fetch`, or `setInterval`. Code runs in a
sandbox — if your file throws, only your file breaks.

## Hot reload

Save and the file re-runs. Anything it registered (commands, handlers) is
swapped in fresh. Custom props you've stuck on host objects survive
(`player.score = 5` keeps its value); local variables in the file don't.

## The rooms and items tabs

The rooms and items tabs in the editor let you tweak descriptions, exits,
items, and colours without writing JS. Those edits layer on top of whatever
your code defines.
