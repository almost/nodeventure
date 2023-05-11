/* Nodeventure loader: loads room and item definitions and sets up a
 * game object. It also handles reloading world modules as they change.
 *
 */
const {VM}        = require('vm2');
const fs          = require("fs");
const util        = require("util");
const game        = require('./game');
const _           = require('underscore');
const WorldModule = require('./world').WorldModule;

module.exports.Loader = Loader;

function Loader(path) {
  var _this = this;
  this.game = new game.Game();
  this.path = path;
  this.modules = {};

  if (!fs.existsSync(this.path + "/.errors")) {
    fs.mkdirSync(this.path + "/.errors");
  }

  if (!fs.existsSync(this.path + "/.logs")) {
    fs.mkdirSync(this.path + "/.logs");
  }


  this.update();
  setInterval(_.bind(this.update, this), 5000);
  // Game's emit has been extended to emit an 'all' event on any event
  this.game.on('all', function (event /* ,args...*/) {
    var args = _.toArray(arguments);
    _.each(_this.modules, function (module) {
      module.emit.apply(module, args);
    });
  });
}

_.extend(Loader.prototype, {
  update: function () {
    var files = fs.readdirSync(this.path),
        _this = this;
    for (var i = 0; i < files.length; i++) {
        let file = files[i],
            fileLower = file.toLowerCase(),
            fullPath = this.path + "/" + file,
            isFile = fs.statSync(fullPath).isFile(),
            mtime = fs.statSync(fullPath).mtime + '',
            // Ignore files starting with ~ or . (it's an Emacs thing):
            isHidden = /^[.~]/.test(file);

        // If this is a file...
        if (isFile && !isHidden) {
          // ...and it has changed...
          if (!this.modules[file] || mtime !== this.modules[file].mtime) {
            // ...then let's look at loading it:

            var code = fs.readFileSync(fullPath, "utf8");

            // Javascript modules:
            if(fileLower.endsWith(".js")) {
              this.loadModule(file, mtime, function(module) {
                const logPath = _this.path  + "/.logs/" + file;
                module.console = {
                  log(...args) {
                    console.log(`[${file}] `, ...args);
                    args = args.map(x => util.inspect(x));
                    fs.appendFileSync(logPath, args.join(" ") + "\n");
                  }
                }
                module.require = function () {
                  throw new Error("No no no no")
                };
                const vm = new VM({
                  sandbox: module
                });
                const errorPath = _this.path  + "/.errors/" + file;

                fs.writeFileSync(logPath, "");


                try {
                  console.log("Loading " + file)
                  this.game._loadingModule = module;
                  vm.run(code, { filename: fullPath });
                  this.game._loadingModule = null;
                  if (fs.existsSync(errorPath)) {
                    fs.unlinkSync(errorPath);
                  }
                } catch(e) {
                  console.trace("Error running world module: " + e);
                  _this.game.broadcast("Oh no some one broke " + file + "!")
                  fs.writeFileSync(errorPath, e.stack)
                }
              });
            }
          }
        }
    }
    return this;
  },

  // string string string -> void
  loadModule: function (name, mtime, func) {
    const errorPath = this.path  + "/.errors/" + name;
    function reportError(message) {
      fs.writeFileSync(errorPath, message)
    }

    var module = new WorldModule(this.game, reportError);
    module.mtime = mtime;
    this.modules[name] = module;
    try {
      func.call(this, module);
      this.game.warn('Reloaded world module: ' + name);
    } catch (e) {
      this.game.error("Error loading world module: " + name + "\n" + e.stack);
    }
  }
});
