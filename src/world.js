import { EventEmitter } from 'node:events';
import _ from 'underscore';

export class WorldModule extends EventEmitter {
  constructor(game, reportError) {
    super();
    this._listenersAdded = [];
    this._spawns = {};
    // Make all regular globals available within the modules (is this a
    // good idea?)
    Object.assign(this, global);
    // Inject underscore for the world modules to use
    this._ = _;
    this.game = game;
    this.reportError = reportError;

    // Make available world creation commands
    this.command = game.createCommand.bind(game);
    this.room = game.createRoom.bind(game);

    // Create a command that expects an item name following it. Will
    // automatically check that the item is present.
    this.itemCommand = (command, item, description, fn) => {
      game.createCommand(`${command} ${item}`, description, fn);
    };

    this.character = (name, properties) => {
      const player = game.createPlayer(name);
      properties.npc = true;
      Object.assign(player, properties);
      return player;
    };

    this.setTimeout = (fn, time) => {
      setTimeout(() => {
        try {
          fn();
        } catch (e) {
          game.broadcast('Error running timeout');
          game.broadcast(e);
          game.broadcast(e.stack);
          console.trace();
        }
      }, time);
    };

    this.handler = (event, fn) => {
      const wrapped = (...args) => {
        try {
          fn.apply(this, args);
        } catch (e) {
          reportError(e.stack);
          game.broadcast(`Oh dear there was an error handling the ${event} event!`);
          console.log(`Error running handler for event: ${event}`);
          console.log(e.stack);
          console.trace();
          this.removeListener(event, wrapped);
        }
      };
      this.on(event, wrapped);
    };

    // Create an item in the given room every respawnTimer seconds if
    // one of the same name does not already exist.
    this.item = (room, name, item) => {
      item.name = name;
      this._spawns[`${room}:${name}`] = {
        room,
        lastSpawn: 0,
        respawnTimer: item.respawnTimer || 10,
        item,
      };
    };

    this.event = (eventName, subjectId, eventHandler) => {
      this.handler(`${eventName}:${subjectId}`, eventHandler);
    };

    this.preventDefault = () => game.preventDefault();

    // Set up a tick handler to check for spawns
    this.handler('tick', () => {
      for (const spawn of Object.values(this._spawns)) {
        const t = Date.now() / 1000;
        const room = game.rooms[spawn.room];
        if (t - spawn.lastSpawn > spawn.respawnTimer) {
          spawn.lastSpawn = t;
          if (room && !room.getItem(spawn.item.name)) {
            const item = { ...spawn.item };
            room.items.push(item);
            game.emit('spawn', room, item);
          }
        }
      }
    });
  }
}
