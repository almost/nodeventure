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
import vm2 from 'vm2';
import { Game } from './game.js';
import { WorldModule } from './world.js';

const { VM } = vm2;

export class Loader {
  constructor(path) {
    this.game = new Game();
    this.path = path;
    this.codePath = `${path}/code`;
    this.dataPath = `${path}/data`;
    this.modules = {};
    this.dataFiles = {};

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

          module.console = {
            log: (...args) => {
              console.log(`[${file}] `, ...args);
              fs.appendFileSync(logPath, args.map((x) => util.inspect(x)).join(' ') + '\n');
            },
          };
          module.require = () => {
            throw new Error('No no no no');
          };

          const vm = new VM({ sandbox: module });
          fs.writeFileSync(logPath, '');

          try {
            console.log(`Loading ${file}`);
            this.game._loadingModule = module;
            vm.run(code, { filename: fullPath });
            this.game._loadingModule = null;
            if (fs.existsSync(errorPath)) {
              fs.unlinkSync(errorPath);
            }
          } catch (e) {
            console.trace(`Error running world module: ${e}`);
            this.game.broadcast(`Oh no some one broke ${file}!`);
            fs.writeFileSync(errorPath, e.stack);
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

    for (const data of Object.values(this.dataFiles)) {
      const { type, id } = data.content;
      if (type === 'room') {
        if (!id) continue;
        let room = this.game.rooms[id];
        if (!room) {
          room = this.game.createRoom(id, {});
        }
        if ('description' in data.content) {
          room.description = data.content.description;
        }
        if (data.content.exits) {
          Object.assign(room.exits, data.content.exits);
        }
      }
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
