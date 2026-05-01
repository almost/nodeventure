// Image editor: list PNG files on the left, paint pixels on the right.
// Saves PUT a fresh PNG to /files/images/<name>.png.

const state = {
  images: [],          // list from /files/images/
  currentName: null,
  history: [],
  selectedVersion: 'current',
  width: 32,
  height: 32,
  // The 1:1 backing canvas holding the actual image data, plus its 2D context.
  canvas: null,
  ctx: null,
  // Snapshot of the last saved state (data URL) so we can detect dirty/revert.
  savedDataUrl: null,
  // Painting tool: 'pencil', 'eraser', 'fill', 'picker'.
  tool: 'pencil',
  color: '#000000',
  // Live drag state — tracks the previous pixel so a fast drag draws a line.
  drag: null,
};

const $ = (sel) => document.querySelector(sel);

// Default palette — classic mspaint-ish 16 colours plus a transparent slot
// at the top so painting transparent pixels is a click away.
const TRANSPARENT = 'transparent';
const PALETTE = [
  TRANSPARENT,
  '#000000', '#7f7f7f', '#880015', '#ed1c24',
  '#ff7f27', '#fff200', '#22b14c', '#00a2e8',
  '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3',
  '#b97a57', '#ffaec9', '#ffc90e', '#b5e61d',
];

const DISPLAY_SCALE = 16; // each painted pixel is 16x16 on screen — well above the 4× minimum.

async function loadImages() {
  const res = await fetch('/files/images/');
  state.images = res.status === 200 ? await res.json() : [];
  renderImageList();
}

function renderImageList() {
  const list = $('#image-list');
  list.innerHTML = '';
  if (!state.images.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.style.textAlign = 'left';
    li.textContent = 'No images yet.';
    list.appendChild(li);
    return;
  }
  for (const img of state.images) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = img.filename;
    if (img.filename === state.currentName) button.classList.add('active');
    if (state.currentName === img.filename && isDirty()) {
      const star = document.createElement('span');
      star.className = 'changed';
      star.textContent = ' *';
      button.appendChild(star);
    }
    button.addEventListener('click', () => selectImage(img.filename));
    li.appendChild(button);
    list.appendChild(li);
  }
}

async function selectImage(filename, version = 'current') {
  if (isDirty() && filename !== state.currentName) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  state.currentName = filename;
  state.selectedVersion = version;
  await loadImageBitmap(filename, version);
  await loadHistory(filename);
  renderEditor();
  renderImageList();
  history.replaceState(null, '', '/images/' + encodeURIComponent(filename));
}

function loadImageBitmap(filename, version) {
  return new Promise((resolve) => {
    let url = '/files/images/' + encodeURIComponent(filename);
    if (version !== 'current') url += '?version=' + version;
    // Cache-bust so saves followed by reload always pull the new bytes.
    url += (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const img = new Image();
    img.onload = () => {
      state.width = img.width || 32;
      state.height = img.height || 32;
      ensureBackingCanvas();
      state.ctx.clearRect(0, 0, state.width, state.height);
      state.ctx.drawImage(img, 0, 0);
      state.savedDataUrl = state.canvas.toDataURL('image/png');
      resolve();
    };
    img.onerror = () => {
      // Couldn't load — leave whatever's currently in the canvas.
      state.savedDataUrl = state.canvas ? state.canvas.toDataURL('image/png') : null;
      resolve();
    };
    img.src = url;
  });
}

function ensureBackingCanvas() {
  if (!state.canvas) state.canvas = document.createElement('canvas');
  state.canvas.width = state.width;
  state.canvas.height = state.height;
  state.ctx = state.canvas.getContext('2d');
  // Pixel-perfect — no smoothing on draws or scaling.
  state.ctx.imageSmoothingEnabled = false;
}

function isDirty() {
  if (!state.canvas || state.savedDataUrl == null) return false;
  return state.canvas.toDataURL('image/png') !== state.savedDataUrl;
}

function renderEditor() {
  const editor = $('#editor');
  if (!state.currentName) {
    editor.innerHTML = '<div class="empty">Pick an image on the left, or create a new one.</div>';
    return;
  }

  editor.innerHTML = `
    <div id="toolbar">
      <h2 id="image-id"></h2>
      <select id="version"></select>
      <button id="save">Save</button>
      <button id="revert">Revert</button>
      <button id="duplicate">Duplicate</button>
      <button id="delete">Delete</button>
    </div>
    <div class="paint-wrap">
      <div id="paint-stage">
        <canvas id="paint"></canvas>
      </div>
      <div class="paint-tools">
        <div class="tool-row" id="tool-row">
          <button data-tool="pencil" title="Pencil">Pencil</button>
          <button data-tool="eraser" title="Eraser">Eraser</button>
          <button data-tool="fill" title="Fill">Fill</button>
          <button data-tool="picker" title="Pick colour">Pick</button>
        </div>
        <div class="tool-row">
          <button id="clear" title="Clear all pixels to transparent">Clear</button>
        </div>
        <label>Colour</label>
        <div class="tool-row">
          <input type="color" id="color-picker" value="${state.color === TRANSPARENT ? '#000000' : state.color}">
          <span class="tool-info" id="color-text">${state.color}</span>
        </div>
        <div class="swatches" id="swatches"></div>
        <div class="tool-info" id="size-info"></div>
      </div>
    </div>
  `;

  $('#image-id').textContent = state.currentName;
  $('#size-info').textContent = `${state.width} × ${state.height} px (displayed ${DISPLAY_SCALE}×)`;

  setupCanvas();
  setupToolButtons();
  setupSwatches();
  setupColorPicker();

  $('#save').addEventListener('click', save);
  $('#revert').addEventListener('click', revert);
  $('#duplicate').addEventListener('click', duplicate);
  $('#delete').addEventListener('click', deleteImage);
  $('#clear').addEventListener('click', clearCanvas);

  renderHistory();
}

function setupCanvas() {
  const visible = $('#paint');
  visible.width = state.width;
  visible.height = state.height;
  visible.style.width = (state.width * DISPLAY_SCALE) + 'px';
  visible.style.height = (state.height * DISPLAY_SCALE) + 'px';
  const vctx = visible.getContext('2d');
  vctx.imageSmoothingEnabled = false;

  const repaint = () => {
    vctx.clearRect(0, 0, state.width, state.height);
    vctx.drawImage(state.canvas, 0, 0);
  };
  repaint();
  state.repaint = repaint;

  const eventToPixel = (e) => {
    const rect = visible.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * state.width / rect.width);
    const y = Math.floor((e.clientY - rect.top) * state.height / rect.height);
    return { x, y };
  };

  const onDown = (e) => {
    e.preventDefault();
    const { x, y } = eventToPixel(e);
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
    if (state.tool === 'fill') {
      floodFill(x, y, state.color);
    } else if (state.tool === 'picker') {
      const hex = pixelToHex(x, y);
      if (hex !== null) setColor(hex);
    } else {
      state.drag = { last: { x, y } };
      paintPixel(x, y);
    }
    state.repaint();
    visible.setPointerCapture(e.pointerId);
    renderImageList();
  };

  const onMove = (e) => {
    if (!state.drag) return;
    const { x, y } = eventToPixel(e);
    const last = state.drag.last;
    drawLine(last.x, last.y, x, y);
    state.drag.last = { x, y };
    state.repaint();
  };

  const onUp = (e) => {
    if (state.drag) state.drag = null;
    if (visible.hasPointerCapture && visible.hasPointerCapture(e.pointerId)) {
      visible.releasePointerCapture(e.pointerId);
    }
    renderImageList();
  };

  visible.addEventListener('pointerdown', onDown);
  visible.addEventListener('pointermove', onMove);
  visible.addEventListener('pointerup', onUp);
  visible.addEventListener('pointercancel', onUp);
  visible.addEventListener('pointerleave', onUp);
  // Right-click / context menu would otherwise pop on long-press.
  visible.addEventListener('contextmenu', (e) => e.preventDefault());
}

function paintPixel(x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return;
  const ctx = state.ctx;
  if (state.tool === 'eraser' || state.color === TRANSPARENT) {
    ctx.clearRect(x, y, 1, 1);
  } else {
    ctx.fillStyle = state.color;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Bresenham — connect successive pointer positions so fast strokes don't gap.
function drawLine(x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    paintPixel(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function pixelToHex(x, y) {
  const data = state.ctx.getImageData(x, y, 1, 1).data;
  if (data[3] === 0) return TRANSPARENT;
  return '#' + [data[0], data[1], data[2]]
    .map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Standard 4-way flood fill on the backing canvas. Replaces every connected
// pixel matching the start pixel's RGBA with the new colour.
function floodFill(sx, sy, hex) {
  const ctx = state.ctx;
  const w = state.width, h = state.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const idx = (x, y) => (y * w + x) * 4;
  const start = idx(sx, sy);
  const targetR = data[start], targetG = data[start + 1],
        targetB = data[start + 2], targetA = data[start + 3];
  let r, g, b, a;
  if (hex === TRANSPARENT) {
    r = 0; g = 0; b = 0; a = 0;
  } else {
    const rgb = hexToRgb(hex);
    r = rgb.r; g = rgb.g; b = rgb.b; a = 255;
  }
  if (targetR === r && targetG === g && targetB === b && targetA === a) return;
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = idx(x, y);
    if (data[i] !== targetR || data[i + 1] !== targetG ||
        data[i + 2] !== targetB || data[i + 3] !== targetA) continue;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function setupToolButtons() {
  const row = $('#tool-row');
  for (const btn of row.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.tool === state.tool);
    btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      for (const b of row.querySelectorAll('button')) {
        b.classList.toggle('active', b === btn);
      }
    });
  }
}

function setupSwatches() {
  const container = $('#swatches');
  container.innerHTML = '';
  for (const c of PALETTE) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    if (c === TRANSPARENT) {
      sw.classList.add('transparent');
      sw.title = 'transparent';
    } else {
      sw.style.background = c;
      sw.title = c;
    }
    sw.dataset.color = c;
    if (c === state.color) sw.classList.add('active');
    sw.addEventListener('click', () => setColor(c));
    container.appendChild(sw);
  }
}

function setupColorPicker() {
  const picker = $('#color-picker');
  if (state.color !== TRANSPARENT) picker.value = state.color;
  picker.addEventListener('input', (e) => setColor(e.target.value));
}

function setColor(hex) {
  state.color = hex === TRANSPARENT ? TRANSPARENT : hex.toLowerCase();
  const picker = $('#color-picker');
  if (picker && state.color !== TRANSPARENT) picker.value = state.color;
  const text = $('#color-text');
  if (text) text.textContent = state.color;
  for (const sw of document.querySelectorAll('#swatches .swatch')) {
    sw.classList.toggle('active', sw.dataset.color === state.color);
  }
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
    selectImage(state.currentName, e.target.value);
  });
}

async function loadHistory(filename) {
  const res = await fetch('/history/images/' + encodeURIComponent(filename));
  state.history = res.status === 200 ? await res.json() : [];
}

function canvasToBlob() {
  return new Promise((resolve) => state.canvas.toBlob((b) => resolve(b), 'image/png'));
}

async function save() {
  const blob = await canvasToBlob();
  const url = '/files/images/' + encodeURIComponent(state.currentName);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
  });
  if (res.status !== 201) {
    alert(`Failed to save (${res.status}): ${await res.text()}`);
    return;
  }
  state.savedDataUrl = state.canvas.toDataURL('image/png');
  await loadImages();
  await loadHistory(state.currentName);
  renderHistory();
  renderImageList();
}

function clearCanvas() {
  if (!state.ctx) return;
  if (!confirm('Clear every pixel to transparent?')) return;
  state.ctx.clearRect(0, 0, state.width, state.height);
  if (state.repaint) state.repaint();
  renderImageList();
}

async function revert() {
  if (isDirty() && !confirm('Discard unsaved changes?')) return;
  await selectImage(state.currentName, state.selectedVersion);
}

async function duplicate() {
  if (!state.canvas) return;
  let id = prompt('New image name (without .png)?', state.currentName.replace(/\.png$/i, '') + '-copy');
  if (!id) return;
  id = id.replace(/\.png$/i, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    alert('Image names must be letters/numbers/dot/dash/underscore only.');
    return;
  }
  // Snapshot the live canvas (so unsaved edits come along) and upload as a new
  // file with ?create=1 so we don't clobber an existing image by mistake.
  const blob = await canvasToBlob();
  const filename = id + '.png';
  const res = await fetch('/files/images/' + encodeURIComponent(filename) + '?create=1', {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
  });
  if (res.status !== 201) {
    alert(`Failed to duplicate (${res.status}): ${await res.text()}`);
    return;
  }
  await loadImages();
  await selectImage(filename);
}

async function deleteImage() {
  if (!confirm(`Delete ${state.currentName}?`)) return;
  const res = await fetch('/files/images/' + encodeURIComponent(state.currentName), { method: 'DELETE' });
  if (res.status !== 201) {
    alert(`Failed to delete (${res.status}): ${await res.text()}`);
    return;
  }
  state.currentName = null;
  await loadImages();
  renderEditor();
  history.replaceState(null, '', '/images/');
}

async function newImage() {
  let id = prompt('New image name (without .png)?');
  if (!id) return;
  id = id.replace(/\.png$/i, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    alert('Image names must be letters/numbers/dot/dash/underscore only.');
    return;
  }
  // Build a fresh 32×32 transparent canvas, encode as PNG, upload with ?create=1.
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  const filename = id + '.png';
  const res = await fetch('/files/images/' + encodeURIComponent(filename) + '?create=1', {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
  });
  if (res.status !== 201) {
    alert(`Failed to create (${res.status}): ${await res.text()}`);
    return;
  }
  await loadImages();
  await selectImage(filename);
}

function loadFromUrl() {
  const bits = window.location.pathname.split('/').filter(Boolean);
  if (bits[0] === 'images' && bits[1]) {
    selectImage(decodeURIComponent(bits[1]));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#new').addEventListener('click', newImage);
  loadImages().then(loadFromUrl);
  setInterval(loadImages, 10000);
});
