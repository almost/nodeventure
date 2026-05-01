// Tile editor: define visual tiles by picking an image, clicking the cell
// you want, and tweaking speed/passable. Multi-frame tiles animate.

const TILE_SIZE = 16;
const PREVIEW_SCALE = 2;

const state = {
  tiles: [],
  images: [],
  currentId: null,
  draft: null,
  initial: null,
  history: [],
  selectedVersion: 'current',
  selectedImage: null,
};

const $ = (sel) => document.querySelector(sel);

async function loadTiles() {
  state.tiles = await (await fetch('/tiles')).json();
  renderTileList();
}

async function loadImages() {
  state.images = await (await fetch('/images')).json();
  if (!state.selectedImage && state.images.length) {
    state.selectedImage = state.images[0].filename;
  }
  if (state.currentId) renderEditor();
}

function renderTileList() {
  const list = $('#room-list');
  list.innerHTML = '';
  for (const tile of state.tiles) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = tile.id;
    if (tile.id === state.currentId) button.classList.add('active');
    if (tile.hasData) {
      const badge = document.createElement('span');
      badge.className = 'badge data';
      badge.textContent = 'data';
      button.appendChild(badge);
    }
    if (state.currentId === tile.id && isDirty()) {
      const star = document.createElement('span');
      star.className = 'changed';
      star.textContent = ' *';
      button.appendChild(star);
    }
    button.addEventListener('click', () => selectTile(tile.id));
    li.appendChild(button);
    list.appendChild(li);
  }
}

async function selectTile(id, version = 'current') {
  if (isDirty() && id !== state.currentId) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  state.currentId = id;
  state.selectedVersion = version;
  await loadTileDraft(id, version);
  await loadHistory(id);
  renderEditor();
  renderTileList();
  history.replaceState(null, '', '/tiles/' + encodeURIComponent(id));
}

async function loadTileDraft(id, version) {
  const tile = state.tiles.find((t) => t.id === id);

  let dataContent = null;
  let url = '/files/tiles/' + encodeURIComponent(id) + '.json';
  if (version !== 'current') url += '?version=' + version;
  const res = await fetch(url);
  if (res.status === 200) {
    try { dataContent = await res.json(); } catch (e) { dataContent = null; }
  }

  // Use whatever overlay/code provides as the starting state. Frames default
  // to one empty frame so the user has something to click.
  const baseFrames = (dataContent && dataContent.frames)
    || (tile && tile.frames)
    || [{ image: state.selectedImage || '', index: 0 }];
  state.draft = {
    frames: baseFrames.map((f) => ({ image: f.image || '', index: f.index || 0 })),
    speed: dataContent && 'speed' in dataContent
      ? dataContent.speed
      : (tile && tile.speed != null ? tile.speed : 200),
    passable: dataContent && 'passable' in dataContent
      ? dataContent.passable
      : (tile ? tile.passable !== false : true),
  };
  state.initial = JSON.stringify(state.draft);
  // Default the picker to whichever image the first frame is using.
  if (state.draft.frames[0] && state.draft.frames[0].image) {
    state.selectedImage = state.draft.frames[0].image;
  }
}

function isDirty() {
  return state.draft && JSON.stringify(state.draft) !== state.initial;
}

function renderEditor() {
  const editor = $('#editor');
  if (!state.currentId) {
    editor.innerHTML = '<div class="empty">Pick a tile on the left, or create a new one.</div>';
    return;
  }
  editor.innerHTML = `
    <div id="toolbar">
      <h2 id="tile-id"></h2>
      <select id="version"></select>
      <button id="save">Save</button>
      <button id="revert">Revert</button>
    </div>

    <div class="field-row">
      <label for="image-select">Image</label>
      <select id="image-select"></select>
    </div>

    <label>Tileset (click a cell to add as frame)</label>
    <div id="tileset-host" style="overflow:auto;border:1px solid #ddd;padding:0.5rem;background:#222">
      <canvas id="tileset" style="image-rendering:pixelated;display:block"></canvas>
    </div>

    <label>Frames <span class="badge" id="frame-hint">click cells above to add</span></label>
    <div id="frames"></div>

    <div class="field-row" style="margin-top:1rem">
      <label for="speed">Speed</label>
      <input type="number" id="speed" min="20" step="20" value="${state.draft.speed}" style="width:6rem"> ms per frame (animation only)
    </div>

    <div class="checkbox-row">
      <input type="checkbox" id="passable" ${state.draft.passable ? 'checked' : ''}>
      <label for="passable" style="margin-top:0">Passable (players can walk through)</label>
    </div>
  `;

  $('#tile-id').textContent = state.currentId;
  populateImageSelect();
  renderFrames();
  renderHistory();
  drawTileset();

  $('#save').addEventListener('click', save);
  $('#revert').addEventListener('click', revert);
  $('#image-select').addEventListener('change', (e) => {
    state.selectedImage = e.target.value;
    drawTileset();
  });
  $('#speed').addEventListener('input', (e) => {
    state.draft.speed = parseInt(e.target.value, 10) || 200;
    renderTileList();
  });
  $('#passable').addEventListener('change', (e) => {
    state.draft.passable = e.target.checked;
    renderTileList();
  });
}

function populateImageSelect() {
  const sel = $('#image-select');
  sel.innerHTML = '';
  if (!state.images.length) {
    const opt = document.createElement('option');
    opt.textContent = '(upload an image first)';
    opt.value = '';
    sel.appendChild(opt);
    return;
  }
  for (const img of state.images) {
    const opt = document.createElement('option');
    opt.value = img.filename;
    opt.textContent = img.filename;
    if (img.filename === state.selectedImage) opt.selected = true;
    sel.appendChild(opt);
  }
}

function renderFrames() {
  const container = $('#frames');
  container.innerHTML = '';
  state.draft.frames.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'exit-row';
    row.innerHTML = `
      <span class="source">#${idx}</span>
      <input type="text" value="${escapeAttr(f.image)}" placeholder="image filename" data-k="image">
      <span class="source">index</span>
      <input type="number" min="0" step="1" class="freq" value="${f.index}" data-k="index">
      <button type="button">×</button>
    `;
    const inputs = row.querySelectorAll('input');
    inputs.forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const k = e.target.dataset.k;
        if (k === 'index') f.index = parseInt(e.target.value, 10) || 0;
        else f[k] = e.target.value;
        renderTileList();
        drawTileset();
      });
    });
    row.querySelector('button').addEventListener('click', () => {
      state.draft.frames.splice(idx, 1);
      if (!state.draft.frames.length) {
        state.draft.frames.push({ image: state.selectedImage || '', index: 0 });
      }
      renderFrames();
      renderTileList();
      drawTileset();
    });
    container.appendChild(row);
  });
}

function drawTileset() {
  const canvas = $('#tileset');
  if (!canvas) return;
  const filename = state.selectedImage;
  if (!filename) {
    canvas.width = 0;
    canvas.height = 0;
    return;
  }
  const img = new Image();
  img.src = '/images/' + encodeURIComponent(filename);
  img.onload = () => {
    const cols = Math.max(1, Math.floor(img.naturalWidth / TILE_SIZE));
    const rows = Math.max(1, Math.floor(img.naturalHeight / TILE_SIZE));
    canvas.width = cols * TILE_SIZE * PREVIEW_SCALE;
    canvas.height = rows * TILE_SIZE * PREVIEW_SCALE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
      0, 0, canvas.width, canvas.height);
    // Grid overlay + frame highlight.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE * PREVIEW_SCALE + 0.5, 0);
      ctx.lineTo(x * TILE_SIZE * PREVIEW_SCALE + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE * PREVIEW_SCALE + 0.5);
      ctx.lineTo(canvas.width, y * TILE_SIZE * PREVIEW_SCALE + 0.5);
      ctx.stroke();
    }
    // Highlight indices currently used by this tile's frames (matching image).
    state.draft.frames.forEach((f, fi) => {
      if (f.image !== filename) return;
      const cx = (f.index % cols) * TILE_SIZE * PREVIEW_SCALE;
      const cy = Math.floor(f.index / cols) * TILE_SIZE * PREVIEW_SCALE;
      ctx.strokeStyle = '#6c6';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1, cy + 1, TILE_SIZE * PREVIEW_SCALE - 2, TILE_SIZE * PREVIEW_SCALE - 2);
      ctx.fillStyle = '#6c6';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`#${fi}`, cx + 4, cy + 12);
      ctx.lineWidth = 1;
    });
  };
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cellW = TILE_SIZE * PREVIEW_SCALE;
    const col = Math.floor(px / cellW * (canvas.width / rect.width));
    const row = Math.floor(py / cellW * (canvas.height / rect.height));
    const cols = canvas.width / cellW;
    const index = row * cols + col;
    // Single-frame default: replace frame 0. If user already has multiple
    // frames, append a new one.
    if (state.draft.frames.length <= 1 &&
        (!state.draft.frames[0] ||
         (state.draft.frames[0].image === filename || !state.draft.frames[0].image))) {
      state.draft.frames = [{ image: filename, index }];
    } else {
      state.draft.frames.push({ image: filename, index });
    }
    renderFrames();
    renderTileList();
    drawTileset();
  };
}

function renderHistory() {
  const sel = $('#version');
  if (!sel) return;
  sel.innerHTML = '';
  const opts = [{ version: 'current', label: 'current' }];
  for (const v of state.history) {
    opts.push({ version: v.version, label: `${v.version} (${new Date(v.mtime).toLocaleString()})` });
  }
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o.version;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }
  sel.value = state.selectedVersion;
  sel.addEventListener('change', (e) => {
    selectTile(state.currentId, e.target.value);
  });
}

async function loadHistory(id) {
  const res = await fetch('/history/tiles/' + encodeURIComponent(id) + '.json');
  state.history = res.status === 200 ? await res.json() : [];
}

function buildOverlay() {
  return {
    type: 'tile',
    id: state.currentId,
    frames: state.draft.frames.filter((f) => f.image),
    speed: state.draft.speed,
    passable: state.draft.passable,
  };
}

async function save() {
  const overlay = buildOverlay();
  const body = JSON.stringify(overlay, null, 2);
  const url = '/files/tiles/' + encodeURIComponent(state.currentId) + '.json';
  const res = await fetch(url, { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to save (${res.status}): ${await res.text()}`);
    return;
  }
  await loadTiles();
  await selectTile(state.currentId);
}

async function revert() {
  if (isDirty() && !confirm('Discard unsaved changes?')) return;
  await selectTile(state.currentId, state.selectedVersion);
}

async function newTile() {
  const id = prompt('New tile id?');
  if (!id) return;
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    alert('Tile ids must be letters/numbers/dot/dash/underscore only.');
    return;
  }
  const body = JSON.stringify({
    type: 'tile', id,
    frames: [{ image: state.selectedImage || '', index: 0 }],
    speed: 200, passable: true,
  }, null, 2);
  const res = await fetch('/files/tiles/' + encodeURIComponent(id) + '.json',
    { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to create (${res.status}): ${await res.text()}`);
    return;
  }
  await loadTiles();
  await selectTile(id);
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function uploadImage(file) {
  const buf = await file.arrayBuffer();
  const res = await fetch('/images/' + encodeURIComponent(file.name),
    { method: 'PUT', body: buf });
  if (res.status !== 201) {
    alert(`Failed to upload (${res.status}): ${await res.text()}`);
    return;
  }
  state.selectedImage = file.name;
  await loadImages();
  if (state.currentId) renderEditor();
}

function loadFromUrl() {
  const bits = window.location.pathname.split('/').filter(Boolean);
  if (bits[0] === 'tiles' && bits[1]) {
    selectTile(decodeURIComponent(bits[1]));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#new').addEventListener('click', newTile);
  $('#upload-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadImage(file);
    e.target.value = '';
  });
  Promise.all([loadTiles(), loadImages()]).then(loadFromUrl);
  setInterval(() => { loadTiles(); loadImages(); }, 10000);
});
