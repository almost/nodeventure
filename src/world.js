import { EventEmitter } from 'node:events';
import _ from 'underscore';

export class WorldModule extends EventEmitter {
  constructor(game, reportError) {
    super();
    this._listenersAdded = [];
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
    this.item = game.createItem.bind(game);
    this.spawn = game.createSpawn.bind(game);

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

    this.event = (eventName, subjectId, eventHandler) => {
      this.handler(`${eventName}:${subjectId}`, eventHandler);
    };

    this.preventDefault = () => game.preventDefault();
  }
}
