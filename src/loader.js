/* Nodeventure loader: loads room and item definitions and sets up a
 * game object. It also handles reloading world modules as they change.
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
    this.modules = {};

    if (!fs.existsSync(`${this.path}/.errors`)) {
      fs.mkdirSync(`${this.path}/.errors`);
    }
    if (!fs.existsSync(`${this.path}/.logs`)) {
      fs.mkdirSync(`${this.path}/.logs`);
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
    const files = fs.readdirSync(this.path);
    for (const file of files) {
      const fileLower = file.toLowerCase();
      const fullPath = `${this.path}/${file}`;
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
          const logPath = `${this.path}/.logs/${file}`;
          const errorPath = `${this.path}/.errors/${file}`;

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
    return this;
  }

  loadModule(name, mtime, func) {
    const errorPath = `${this.path}/.errors/${name}`;
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
