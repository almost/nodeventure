/*
 * Nodeventure client JS
 *
 * Display code that runs in the context of the iframe
 */

(function () {
  "use strict";

  function DisplayAPI() {
    this.iframe = null;
    this.reset();
  }

  DisplayAPI.prototype.reset = function () {
    this._queue = null;
    if (this.iframe) {
      this.iframe.parentNode.removeChild(this.iframe);
    }

    var parent = document.querySelector("#display");
    // this.iframe = document.createElement('iframe');
    // parent.appendChild(this.iframe);
    // this.doc = this.iframe.contentDocument;
    // this.win = this.iframe.contentWindow;

    this.doc = document;
    this.win = window;
    this.body = parent;
    this.win.display = this;

    // this.addScript("//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js");
  };

  DisplayAPI.prototype._run = function (fn) {
    if (this._queue) {
      this._queue.push(fn);
    } else {
      fn.call(this);
    }
  };

  DisplayAPI.prototype._flushQueue = function () {
    var that = this;
    if (!this._queue) return;
    var rest = this._queue.slice(1);
    var next = this._queue[0];
    this._queue = null;
    if (next) {
      next.call(this);
    }
    rest.forEach(function (x) {
      that._run(x);
    });
  };

  DisplayAPI.prototype.addScript = function (script) {
    var that = this;
    this._run(function () {
      this._queue = [];
      var scriptEl = this.doc.createElement("script");
      scriptEl.src = script;
      scriptEl.onload = function () {
        that._flushQueue();
      };
      this.body.appendChild(scriptEl);
    });
  };

  DisplayAPI.prototype.eval = function (string, args) {
    this._run(function () {
      var wrapped =
        "with (" + JSON.stringify(args || {}) + ") {" + string + "}";
      this.win.eval(wrapped);
    });
  };

  // id, x and y are optional
  DisplayAPI.prototype.show = function (imageUrl, id, style) {
    this._run(function () {
      if (id != null) {
        var el = this.doc.getElementById(id);
        if (el) {
          el.parentNode.removeChild(el);
        }
      }
      if (imageUrl) {
        var img = this.doc.createElement("img");
        img.src = imageUrl;
        img.style.position = "absolute";
        this.body.appendChild(img);
        for (var s in style) {
          img.style[s] = style[s];
        }
        if (id != null) {
          img.id = id;
        }
      }
    });
  };

  DisplayAPI.prototype.draw = function (id, items) {
    this._run(function () {
      let canvas;
      const existingCanvas = document.querySelector(`canvas#${id}`);
      if (existingCanvas != null) {
        canvas = existingCanvas;
      } else {
        canvas = this.doc.createElement("canvas");
        this.body.appendChild(canvas);
      }
      canvas.id = id;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.overflow = "hidden";

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      items.forEach((item) => {
        const xRawHash = hashString(`${item.name}x`);
        const yRawHash = hashString(`${item.name}y`);
        const colourRawHash = hashString(`${item.name}colour`);
        const padding = 3;
        const height = 10;
        const { width } = ctx.measureText(item.name);
        ctx.font = `${height}px`;
        const x =
          positiveModulo(xRawHash, canvas.width - width - 2 * padding) +
          padding;
        const y =
          positiveModulo(yRawHash, canvas.height - height - 2 * padding) +
          padding;
        ctx.fillStyle = `hsl(${positiveModulo(colourRawHash, 360)},100%,50%)`;
        ctx.fillRect(
          x - padding,
          y - padding - height / 2,
          Math.min(50, width) + 2 * padding,
          height + 2 * padding
        );
        ctx.fillStyle = "white";
        ctx.fillText(item.name, x, y, 50);
      });
    });
  };

  window.display = new DisplayAPI();
})();

function positiveModulo(a, b) {
  return ((a % b) + b) % b;
}

function hashString(str) {
  let hash = 0;
  if (str.length == 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
