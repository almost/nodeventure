import { EventEmitter } from 'node:events';

/* WorldModule is the host-side handle for one world JS file.
 *
 * It is a normal Node EventEmitter that the loader forwards game events to;
 * the guest module subscribes via `handler(...)` / `event(...)` which register
 * listeners on this emitter. The methods exposed by `globals()` are the API
 * surface installed as guest globals by the Sandbox — they're plain host
 * functions, never run inside the isolate.
 */
export class WorldModule extends EventEmitter {
  constructor(game, reportError) {
    super();
    this.game = game;
    this.reportError = reportError;
  }

  globals() {
    const game = this.game;
    const reportError = this.reportError;
    const self = this;

    const handler = (event, fn) => {
      const wrapped = (...args) => {
        try {
          fn.apply(undefined, args);
        } catch (e) {
          reportError(e.stack || String(e));
          game.broadcast(`Oh dear there was an error handling the ${event} event!`);
          console.log(`Error running handler for event: ${event}`);
          console.log(e.stack || e);
          self.removeListener(event, wrapped);
        }
      };
      self.on(event, wrapped);
    };

    return {
      command: game.createCommand.bind(game),
      room: game.createRoom.bind(game),
      item: game.createItem.bind(game),
      spawn: game.createSpawn.bind(game),

      itemCommand: (command, item, description, fn) => {
        game.createCommand(`${command} ${item}`, description, fn);
      },

      character: (name, properties) => {
        const player = game.createPlayer(name);
        if (properties) {
          properties.npc = true;
          Object.assign(player, properties);
        }
        return player;
      },

      setTimeout: (fn, time) => {
        setTimeout(() => {
          try {
            fn();
          } catch (e) {
            game.broadcast('Error running timeout');
            game.broadcast(e.stack || String(e));
          }
        }, time);
      },

      handler,
      event: (eventName, subjectId, eventHandler) => handler(`${eventName}:${subjectId}`, eventHandler),

      preventDefault: () => game.preventDefault(),

      lights: (color, ledIndex, fadeMs) => game.lights.set(color, ledIndex, fadeMs),
    };
  }
}
