/* 8-bit-ish grid renderer for the play page.
 *
 * Listens for `roomstate` messages from the server (room.grid + items with
 * coordinates) and draws them on a canvas. Tile definitions are fetched once
 * over HTTP and refreshed periodically; tileset images are loaded lazily.
 *
 * Animations are handled by tracking time and picking the right frame index
 * for each tile on every requestAnimationFrame tick.
 */
(function () {
  "use strict";

  var GRID_WIDTH = 17;
  var GRID_HEIGHT = 12;
  var TILE_SIZE = 16;
  var SCALE = 2;             // CSS upscale; canvas pixels stay 1:1 with art

  var canvas = document.getElementById("grid");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Render at native pixel size; the browser does the integer upscale via
  // `image-rendering: pixelated` so every source pixel becomes a clean block.
  canvas.width = GRID_WIDTH * TILE_SIZE;
  canvas.height = GRID_HEIGHT * TILE_SIZE;
  canvas.style.width = (canvas.width * SCALE) + "px";
  canvas.style.height = (canvas.height * SCALE) + "px";

  var tilesById = {};         // id → tile definition from /tiles
  var images = {};            // image filename → HTMLImageElement
  var roomState = null;       // last received {roomId, grid, items}
  var startTime = performance.now();

  function loadImage(filename) {
    if (images[filename]) return images[filename];
    var img = new Image();
    img.src = "/images/" + encodeURIComponent(filename);
    images[filename] = img;
    return img;
  }

  function refreshTiles() {
    fetch("/tiles").then(function (r) { return r.json(); }).then(function (list) {
      var next = {};
      list.forEach(function (t) { next[t.id] = t; });
      tilesById = next;
    }).catch(function () { /* ignore */ });
  }

  // Pick the active frame for a tile based on elapsed time.
  function frameForTile(tile, now) {
    var frames = tile && tile.frames;
    if (!frames || !frames.length) return null;
    if (frames.length === 1) return frames[0];
    var speed = tile.speed > 0 ? tile.speed : 200;
    var idx = Math.floor((now - startTime) / speed) % frames.length;
    return frames[idx];
  }

  // Draw one (image,index) frame at canvas cell (cellX, cellY).
  function drawFrame(frame, cellX, cellY) {
    if (!frame || !frame.image) return;
    var img = loadImage(frame.image);
    if (!img.complete || !img.naturalWidth) return;
    var cols = Math.max(1, Math.floor(img.naturalWidth / TILE_SIZE));
    var index = frame.index || 0;
    var sx = (index % cols) * TILE_SIZE;
    var sy = Math.floor(index / cols) * TILE_SIZE;
    var dx = cellX * TILE_SIZE;
    var dy = cellY * TILE_SIZE;
    ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
  }

  function render() {
    var now = performance.now();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (roomState) {
      var grid = roomState.grid;
      if (Array.isArray(grid)) {
        for (var y = 0; y < GRID_HEIGHT; y++) {
          var row = grid[y];
          if (!Array.isArray(row)) continue;
          for (var x = 0; x < GRID_WIDTH; x++) {
            var tileId = row[x];
            if (!tileId) continue;
            var tile = tilesById[tileId];
            drawFrame(frameForTile(tile, now), x, y);
          }
        }
      }
      // Items with grid coordinates render on top of the floor tile.
      (roomState.items || []).forEach(function (item) {
        if (item.x == null || item.y == null) return;
        if (!item.tile) return;
        var t = tilesById[item.tile];
        drawFrame(frameForTile(t, now), item.x, item.y);
      });
    }

    requestAnimationFrame(render);
  }

  window.gridView = {
    update: function (state) { roomState = state; },
    refreshTiles: refreshTiles,
  };

  refreshTiles();
  setInterval(refreshTiles, 5000);
  requestAnimationFrame(render);
})();
