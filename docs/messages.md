# Messages

`player.write(...)`, `room.broadcast(...)`, and `game.broadcast(...)` accept
either a plain string or an object with one or more of these keys:

| Key       | Effect                                                          |
| --------- | --------------------------------------------------------------- |
| `string`  | Plain text line.                                                |
| `html`    | HTML line (rendered, not escaped — careful with player input).  |
| `error`   | `{ string, type? }` — shown styled, defaults to a "warn" look.  |
| `effect`  | Calls `window[effect]()` in the browser.                        |
| `display` | `{ command, arguments }` — same as `player.display.<command>()`.|
| `lights`  | `{ color: [r,g,b], ledIndex, fadeMs }` — sets the page header.  |

A plain string is shorthand for `{ string: "..." }`.

    player.write("Hello.");
    player.write({ html: "<b>Hello.</b>" });
    player.write({ error: { string: "That didn't work.", type: "error" } });
    game.broadcast({ string: "The lights flicker." });

You usually won't build the `display` or `lights` keys by hand — use
`player.display.show(...)` and the global `lights(...)` instead.
