/* Nodeventure loader: loads room and item definitions and sets up a
 * game object. It also handles reloading world modules as they change.
 *
 * In addition to JS modules from the world directory, JSON data files in
 * the `data/` subdirectory are loaded as overlays on top of the code-defined
 * world. Each data file looks like:
 *
 *   { "type": "room", "id": "home", "description": "...", "exits": {...} }
 *
 * Data overlays are applied after every JS reload cycle: the room is reset
 * to its code-provided props (snapshotted in `room._codeProps`) and then the
 * data overlay is applied on top. For rooms, description replaces and exits
 * merge with the code-provided exits.
 */
import fs from 'node:fs';
import util from 'node:util';
import { Game } from './game.js';
import { WorldModule } from './world.js';
import { Sandbox } from './sandbox.js';

export class Loader {
  constructor(path) {
    this.game = new Game();
    this.path = path;
    this.codePath = `${path}/code`;
    this.dataPath = `${path}/data`;
    this.modules = {};
    this.dataFiles = {};
    this.sandbox = new Sandbox();

    if (!fs.existsSync(this.codePath)) {
      fs.mkdirSync(this.codePath, { recursive: true });
    }
    if (!fs.existsSync(`${this.codePath}/.errors`)) {
      fs.mkdirSync(`${this.codePath}/.errors`);
    }
    if (!fs.existsSync(`${this.codePath}/.logs`)) {
      fs.mkdirSync(`${this.codePath}/.logs`);
    }
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath);
    }

    this.update();
    setInterval(() => this.update(), 5000);

    // Game's emit has been extended to emit an 'all' event on any event
    this.game.on('all', (event, ...args) => {
      for (const module of Object.values(this.modules)) {
        module.emit(event, ...args);
      }
    });

    this.game.on('tick', () => this.processSpawns());
  }

  // Run on every game tick. Walks every spawn rule (from code or data) and
  // drops a fresh copy of the referenced item into the target room when its
  // cooldown has elapsed and the room doesn't already contain that item.
  processSpawns() {
    const now = Date.now() / 1000;
    for (const spawn of Object.values(this.game.spawns)) {
      if (now - spawn.lastSpawn < spawn.spawnSeconds) continue;
      spawn.lastSpawn = now;
      const room = this.game.rooms[spawn.roomId];
      const def = this.game.items[spawn.itemId];
      if (!room || !def) continue;
      if (room.getItem(def.id)) continue;
      // Clone the item def into the room. Strip framework-only fields so the
      // copy is a plain item the rest of the game can mutate independently.
      const { _codeProps, game: _g, ...rest } = def;
      const copy = { ...rest };
      room.items.push(copy);
      this.game.emit('spawn', room, copy);
    }
  }

  update() {
    const files = fs.readdirSync(this.codePath);
    for (const file of files) {
      const fileLower = file.toLowerCase();
      const fullPath = `${this.codePath}/${file}`;
      const stat = fs.statSync(fullPath);
      const isFile = stat.isFile();
      const mtime = `${stat.mtime}`;
      // Ignore files starting with ~ or . (it's an Emacs thing)
      const isHidden = /^[.~]/.test(file);
      if (!isFile || isHidden) continue;

      const existing = this.modules[file];
      if (existing && mtime === existing.mtime) continue;

      const code = fs.readFileSync(fullPath, 'utf8');

      if (fileLower.endsWith('.js')) {
        this.loadModule(file, mtime, (module) => {
          const logPath = `${this.codePath}/.logs/${file}`;
          const errorPath = `${this.codePath}/.errors/${file}`;

          const log = (...args) => {
            console.log(`[${file}] `, ...args);
            fs.appendFileSync(logPath, args.map((x) => util.inspect(x)).join(' ') + '\n');
          };
          // Game.createRoom looks up `_loadingModule.console.log` to surface
          // missing-inverse-exit warnings while a module loads.
          module.console = { log };

          fs.writeFileSync(logPath, '');

          try {
            console.log(`Loading ${file}`);
            this.game._loadingModule = module;
            this.sandbox.runModule({
              code,
              filename: fullPath,
              globals: module.globals(),
              consoleLog: log,
            });
            this.game._loadingModule = null;
            if (fs.existsSync(errorPath)) {
              fs.unlinkSync(errorPath);
            }
          } catch (e) {
            this.game._loadingModule = null;
            console.trace(`Error running world module: ${e}`);
            this.game.broadcast(`Oh no some one broke ${file}!`);
            fs.writeFileSync(errorPath, e.stack || String(e));
          }
        });
      }
    }

    this.updateData();
    this.applyDataOverlays();
    return this;
  }

  updateData() {
    const seen = new Set();
    if (fs.existsSync(this.dataPath)) {
      for (const file of fs.readdirSync(this.dataPath)) {
        if (/^[.~]/.test(file)) continue;
        if (!file.toLowerCase().endsWith('.json')) continue;
        const fullPath = `${this.dataPath}/${file}`;
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        seen.add(file);
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          this.dataFiles[file] = { content };
        } catch (e) {
          console.log(`Error parsing data file ${file}: ${e}`);
          this.game.broadcast(`Oh no, ${file} is not valid JSON!`);
        }
      }
    }
    // Drop any data files that have been deleted from disk.
    for (const file of Object.keys(this.dataFiles)) {
      if (!seen.has(file)) delete this.dataFiles[file];
    }
  }

  applyDataOverlays() {
    // Reset every room to its code-provided state so removed/changed overlays
    // don't leave stale exits or descriptions behind.
    for (const room of Object.values(this.game.rooms)) {
      const props = room._codeProps;
      if (props) {
        room.description = 'description' in props
          ? props.description
          : 'This is a room';
        room.exits = { ...(props.exits || {}) };
      }
    }

    // Reset items to their code-provided state. Drop any keys that aren't in
    // _codeProps (those came from a previous data overlay) and then re-apply.
    for (const item of Object.values(this.game.items)) {
      const props = item._codeProps;
      if (!props) continue;
      for (const key of Object.keys(item)) {
        if (key === 'id' || key === '_codeProps' || key === 'game') continue;
        delete item[key];
      }
      Object.assign(item, props);
      if (!item.name) item.name = item.id;
    }

    // Reset spawns. Code-defined spawns are rebuilt from _codeProps; data-only
    // spawns get dropped and re-added below. lastSpawn is preserved so cooldowns
    // survive overlay reloads.
    const oldSpawns = this.game.spawns;
    this.game.spawns = {};
    for (const [key, spawn] of Object.entries(oldSpawns)) {
      if (!spawn._codeProps) continue;
      this.game.spawns[key] = {
        roomId: spawn.roomId,
        itemId: spawn.itemId,
        spawnSeconds: spawn._codeProps.spawnSeconds || 60,
        lastSpawn: spawn.lastSpawn,
        _codeProps: spawn._codeProps,
      };
    }

    // Apply room overlays (description, exits, item spawns).
    for (const data of Object.values(this.dataFiles)) {
      const c = data.content;
      if (c.type !== 'room' || !c.id) continue;
      let room = this.game.rooms[c.id];
      if (!room) room = this.game.createRoom(c.id, {});
      if ('description' in c) room.description = c.description;
      if (c.exits) Object.assign(room.exits, c.exits);
      if (Array.isArray(c.items)) {
        for (const entry of c.items) {
          if (!entry || !entry.itemId) continue;
          const seconds = Math.max(1, parseInt(entry.spawnSeconds, 10) || 60);
          const key = `${c.id}:${entry.itemId}`;
          const previous = oldSpawns[key];
          this.game.spawns[key] = {
            roomId: c.id,
            itemId: entry.itemId,
            spawnSeconds: seconds,
            lastSpawn: (previous && previous.lastSpawn) || 0,
            _codeProps: previous && previous._codeProps,
          };
        }
      }
    }

    // Apply item overlays. Anything in the data file (other than type/id)
    // overrides the code-provided value.
    for (const data of Object.values(this.dataFiles)) {
      const c = data.content;
      if (c.type !== 'item' || !c.id) continue;
      let item = this.game.items[c.id];
      if (!item) item = this.game.createItem(c.id, {});
      for (const [key, value] of Object.entries(c)) {
        if (key === 'type' || key === 'id') continue;
        item[key] = value;
      }
      if (!item.name) item.name = item.id;
    }
  }

  loadModule(name, mtime, func) {
    const errorPath = `${this.codePath}/.errors/${name}`;
    const reportError = (message) => fs.writeFileSync(errorPath, message);

    const module = new WorldModule(this.game, reportError);
    module.mtime = mtime;
    this.modules[name] = module;
    try {
      func(module);
      this.game.warn(`Reloaded world module: ${name}`);
    } catch (e) {
      this.game.error(`Error loading world module: ${name}\n${e.stack}`);
    }
  }
}
