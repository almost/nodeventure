/* Nodeventure game engine: Is responsible for running the game,
 * contains the core logic but is extended by the world modules.
 */
import { EventEmitter } from 'node:events';
import { Lights } from './lights.js';

// An interface to the client side code, see display.js on the client
export class Display {
  constructor(object, broadcast) {
    this.object = object;
    this.broadcast = broadcast;
  }

  eval(code, vars) {
    if (typeof code === 'function') {
      code = `(${code.toString()})(display)`;
    }
    this._command('eval', [code, vars]);
  }

  reset() {
    this._command('reset', []);
  }

  show(imageUrl, id, style) {
    this._command('show', [imageUrl, id, style]);
  }

  draw(id, items) {
    this._command('draw', [id, items]);
  }

  _command(command, args) {
    this.broadcast.call(this.object, { display: { command, arguments: args } });
  }
}

// Match an item against a user-supplied query. Items are addressable by id
// (canonical), name (display, what users normally type), or short.
function matchItem(item, query) {
  const lower = query.toLowerCase();
  return (
    (item.id && item.id.toLowerCase() === lower) ||
    (item.name && item.name.toLowerCase() === lower) ||
    (item.short && item.short.toLowerCase() === lower)
  );
}

export class Item {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.name = id;
  }
}

export class Room {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.description = 'This is a room';
    this.image = null;
    this.exits = {};
    this.items = [];
    this.display = new Display(this, this.broadcast);
  }

  getExit(name) {
    const exit = this.exits[name];
    return exit && this.game.rooms[exit];
  }

  getPlayers() {
    return Object.values(this.game.players).filter((player) => player.location === this.id);
  }

  getPlayer(name) {
    const lower = name.toLowerCase();
    return this.getPlayers().find((p) => p.name.toLowerCase() === lower);
  }

  getItem(query) {
    return this.items.find((item) => matchItem(item, query));
  }

  // Send a message to all players in the room. Optionally exclude one player
  // (e.g. the one who triggered the message).
  broadcast(message, excludePlayer) {
    const excludeName = excludePlayer && excludePlayer.name ? excludePlayer.name : excludePlayer;
    for (const player of this.getPlayers()) {
      if (excludeName !== player.name) {
        player.write(message);
      }
    }
  }
}

export class Player extends EventEmitter {
  constructor(game, name) {
    super();
    this.location = 'home';
    this.game = game;
    this.name = name;
    this.inventory = [];
    this.display = new Display(this, this.write);
  }

  execute(string) {
    this.game.execute(this, string);
  }

  write(message) {
    if (typeof message === 'string') {
      message = { string: message };
    }
    this.emit('write', message);
  }

  broadcast(message) {
    this.getCurrentRoom().broadcast(message, this);
  }

  getItem(query) {
    return this.inventory.find((item) => matchItem(item, query));
  }

  getCurrentRoom() {
    if (!this.game.rooms[this.location]) {
      const keys = Object.keys(this.game.rooms);
      this.location = keys[Math.floor(Math.random() * keys.length)];
    }
    return this.game.rooms[this.location];
  }

  setCurrentRoom(id) {
    if (id && id.id) {
      id = id.id;
    }
    if (id in this.game.rooms) {
      const previous = this.getCurrentRoom();
      if (previous) {
        this.game.emit(`roomTransition:${previous.id}:${id}`, this, this.game.rooms[id], previous);
        this.game.emit('leaveRoom', this, previous, this.game);
        this.game.emit(`leaveRoom:${previous.id}`, this, previous, this.game);
      }
      this.location = id;
      const next = this.getCurrentRoom();
      if (next) {
        this.game.emit('enterRoom', this, next, this.game);
        this.game.emit(`enterRoom:${next.id}`, this, next, this.game);
      }
    }
  }

  receive(giver, item) {
    this.inventory.push(item);
    if (typeof this.onReceive === 'function') {
      this.onReceive(giver, item);
    }
  }
}

// Represents a running game (usually you'd just have one!)
//
// Inherits from EventEmitter so the world modules (via the facade in loader.js)
// can listen to game events. The facade also handles disconnecting them when
// world modules are reloaded.
export class Game extends EventEmitter {
  constructor() {
    super();
    this.rooms = {};
    this.items = {};
    // Spawn rules keyed by `${roomId}:${itemId}`. Each entry has roomId,
    // itemId, spawnSeconds, lastSpawn, and a `_codeProps` snapshot used by
    // the loader to re-apply data overlays cleanly.
    this.spawns = {};
    this.players = {};
    this.commands = {};
    this._allowDefault = true;
    this._loadingModule = null;
    setInterval(() => this.emit('tick'), 1000);
    this.display = new Display(this, this.broadcast);
    this.lights = new Lights((message) => this.broadcast(message));
  }

  // Create or return a named player
  createPlayer(name) {
    name = name.toLowerCase();
    if (!(name in this.players)) {
      const player = new Player(this, name);
      this.players[name] = player;
      this.emit('joinPlayer', player, this);
      if (player.getCurrentRoom()) {
        this.emit('enterRoom', player, player.getCurrentRoom(), this);
      }
    }
    return this.players[name];
  }

  getPlayer(name) {
    const lower = name.toLowerCase();
    return Object.values(this.players).find((p) => p.name.toLowerCase() === lower);
  }

  // Create or return a room. Usually called by the facade in loader.js
  createRoom(id, options) {
    const room = this.rooms[id] = this.rooms[id] || new Room(this, id);
    // Snapshot the code-provided props so data overlays can be re-applied
    // cleanly on each load cycle without leaking state from prior overlays.
    room._codeProps = { ...options, exits: { ...(options.exits || {}) } };
    Object.assign(room, options);
    room.exits = { ...(options.exits || {}) };
    room.items = room.items || [];

    for (const exit in room.exits) {
      const toroom = this.rooms[room.exits[exit]];
      if (!toroom) continue;
      let reverseFound = false;
      for (const reverseExit in toroom.exits) {
        if (toroom.exits[reverseExit] === id) {
          reverseFound = true;
        }
      }
      if (!reverseFound && this._loadingModule) {
        this._loadingModule.console.log(
          `[ROOM ${id}] Missing inverse of exit: ${exit}. How are people meant to get back?`
        );
      }
    }

    return room;
  }

  // Create or update an item definition. Items are first-class entities
  // identified by id; `name` (defaults to id) is what users see and type.
  createItem(id, options = {}) {
    const item = this.items[id] = this.items[id] || new Item(this, id);
    item._codeProps = { ...options };
    Object.assign(item, options);
    item.id = id;
    if (!item.name) item.name = id;
    return item;
  }

  // Register a spawn rule that periodically creates a copy of the item in the
  // room. spawnSeconds defaults to 60.
  createSpawn(roomId, itemId, options = {}) {
    const key = `${roomId}:${itemId}`;
    const existing = this.spawns[key];
    const spawn = this.spawns[key] = {
      roomId,
      itemId,
      spawnSeconds: options.spawnSeconds || 60,
      lastSpawn: existing ? existing.lastSpawn : 0,
      _codeProps: { ...options },
    };
    return spawn;
  }

  createCommand(command, description, fun) {
    if (!fun) {
      fun = description;
      description = 'no description for this command. boooo!';
    }
    fun.description = description;
    this.commands[command] = fun;
  }

  // Broadcast out a message to all logged in users
  broadcast(message) {
    for (const player of Object.values(this.players)) {
      player.write(message);
    }
  }

  error(message) {
    this.broadcast({ error: { string: message, type: 'error' } });
    console.log(message);
  }

  warn(message) {
    this.broadcast({ error: { string: message } });
    console.log(message);
  }

  execute(player, string) {
    const trimmed = string.trim();
    const command = trimmed.split(' ', 1)[0].toLowerCase();
    const rest = trimmed.slice(command.length).trim();
    const itemName = rest.split(' ')[0].trim().toLowerCase();
    const itemCommand = `${command} ${itemName}`;

    try {
      if (Object.hasOwn(this.commands, itemCommand)) {
        const item = player.getItem(itemName) || player.getCurrentRoom().getItem(itemName);
        if (item) {
          this.commands[itemCommand](rest, player, item, this);
        } else {
          player.write(`Can't find a ${itemName}`);
        }
      } else if (!Object.hasOwn(this.commands, command)) {
        if (player.getCurrentRoom().getExit(command)) {
          player.execute(`go ${command}`);
        } else {
          player.write(`Awfully sorry old chap, but I don't understand: ${string}`);
        }
      } else {
        this.commands[command](rest, player, this);
        this.emit(`command:${command}`, rest, player, this);
      }
    } catch (e) {
      console.log(`Error running command: ${string}`);
      console.log(e);
      console.trace();
      player.write('OH NO! There was an error handling your command. Watch out for the stack trace!');
      player.write(e);
      player.write(e.stack);
    }
  }

  // Override emit so every event is also re-emitted as 'all' for forwarding.
  emit(event, ...args) {
    const result = super.emit(event, ...args);
    super.emit('all', event, ...args);
    return result;
  }

  // Called from inside an event handler to suppress the default ('*') variant.
  preventDefault() {
    this._allowDefault = false;
  }

  emitEvent(verbId, objectId, subject, object) {
    this._allowDefault = true;
    this.emit(`${verbId}:${objectId}`, this, subject, object);
    if (this._allowDefault) {
      this.emit(`${verbId}:*`, this, subject, object);
    }
  }
}
