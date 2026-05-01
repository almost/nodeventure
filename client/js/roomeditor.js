// Room editor: list rooms on the left, edit description + exits on the right.
// Saves create / overwrite a JSON file under world/data/rooms/<id>.json which
// the loader applies as an overlay on top of the code-defined room.

const state = {
  rooms: [],          // list from /rooms
  items: [],          // list from /items
  images: [],         // PNG filenames from /files/images/
  currentId: null,
  draft: null,        // { description, exits: [{name, to, source}], items: [{itemId, spawnSeconds}] }
  initial: null,      // snapshot used to detect changes
  history: [],
  selectedVersion: 'current',
};

const $ = (sel) => document.querySelector(sel);

const DIRECTIONS = [
  'north', 'northeast', 'east', 'southeast',
  'south', 'southwest', 'west', 'northwest',
];

async function loadRooms() {
  const res = await fetch('/rooms');
  state.rooms = await res.json();
  renderRoomList();
}

async function loadItems() {
  const res = await fetch('/items');
  state.items = await res.json();
}

async function loadImages() {
  const res = await fetch('/files/images/');
  state.images = res.status === 200 ? await res.json() : [];
}

function renderRoomList() {
  const list = $('#room-list');
  list.innerHTML = '';
  for (const room of state.rooms) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = room.id;
    if (room.id === state.currentId) button.classList.add('active');
    if (room.hasData) {
      const badge = document.createElement('span');
      badge.className = 'badge data';
      badge.textContent = 'data';
      button.appendChild(badge);
    }
    if (state.currentId === room.id && isDirty()) {
      const star = document.createElement('span');
      star.className = 'changed';
      star.textContent = ' *';
      button.appendChild(star);
    }
    button.addEventListener('click', () => selectRoom(room.id));
    li.appendChild(button);
    list.appendChild(li);
  }
}

async function selectRoom(id, version = 'current') {
  if (isDirty() && id !== state.currentId) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  state.currentId = id;
  state.selectedVersion = version;
  await loadRoomDraft(id, version);
  await loadHistory(id);
  renderEditor();
  renderRoomList();
  history.replaceState(null, '', '/rooms/' + encodeURIComponent(id));
}

async function loadRoomDraft(id, version) {
  // Combine code-provided exits (from /rooms) with the data overlay
  // (from world/data/rooms/<id>.json) so the user can see and override either.
  const room = state.rooms.find((r) => r.id === id);
  const codeExits = (room && room.codeExits) || {};

  let dataContent = null;
  let url = '/files/rooms/' + encodeURIComponent(id) + '.json';
  if (version !== 'current') url += '?version=' + version;
  const res = await fetch(url);
  if (res.status === 200) {
    try { dataContent = await res.json(); } catch (e) { dataContent = null; }
  }

  // Build a unified list of exits. `source` tells the user whether the exit
  // is currently coming from code or from the data overlay.
  const exitNames = new Set([...Object.keys(codeExits), ...Object.keys((dataContent && dataContent.exits) || {})]);
  const exits = [];
  for (const name of exitNames) {
    const dataTo = dataContent && dataContent.exits && dataContent.exits[name];
    const codeTo = codeExits[name];
    exits.push({
      name,
      to: dataTo !== undefined ? dataTo : codeTo,
      source: dataTo !== undefined ? 'data' : 'code',
    });
  }

  const items = Array.isArray(dataContent && dataContent.items)
    ? dataContent.items.map((it) => ({
        itemId: it.itemId || '',
        spawnSeconds: it.spawnSeconds != null ? it.spawnSeconds : 60,
      }))
    : [];

  const codeColor = (room && room.codeColor) || null;
  const colorFromData = !!(dataContent && 'color' in dataContent);
  const color = colorFromData ? dataContent.color : codeColor;

  const codeImage = (room && room.codeImage) || null;
  const imageFromData = !!(dataContent && 'image' in dataContent);
  const image = imageFromData ? dataContent.image : (room ? room.image : null);

  state.draft = {
    description: dataContent && 'description' in dataContent
      ? dataContent.description
      : (room ? room.description : ''),
    descriptionFromData: !!(dataContent && 'description' in dataContent),
    exits,
    codeExits,
    items,
    color,
    colorFromData,
    codeColor,
    image,
    imageFromData,
    codeImage,
  };
  state.initial = JSON.stringify(state.draft);
}

function isDirty() {
  return state.draft && JSON.stringify(state.draft) !== state.initial;
}

function renderEditor() {
  const editor = $('#editor');
  if (!state.currentId) {
    editor.innerHTML = '<div class="empty">Pick a room on the left, or create a new one.</div>';
    return;
  }
  editor.innerHTML = `
    <div id="toolbar">
      <h2 id="room-id"></h2>
      <select id="version"></select>
      <button id="save">Save</button>
      <button id="revert">Revert</button>
    </div>
    <label for="description">Description <span class="badge" id="desc-source"></span></label>
    <textarea id="description"></textarea>
    <label>Light color <span class="badge" id="color-source"></span></label>
    <div id="color-row" class="color-row">
      <input type="checkbox" id="color-enabled">
      <input type="color" id="color-picker" value="#ffffff">
      <input type="text" id="color-text" placeholder="#rrggbb or name" autocomplete="off">
      <button type="button" id="color-clear">Clear</button>
    </div>
    <label>Image <span class="badge" id="image-source"></span></label>
    <div class="image-select">
      <select id="image-select"></select>
      <img class="image-preview" id="image-preview" alt="">
    </div>
    <label>Exits</label>
    <div id="exits"></div>
    <button id="add-exit" style="margin-top:0.5rem">+ Add exit</button>
    <label>Items</label>
    <div id="items"></div>
    <button id="add-item" style="margin-top:0.5rem">+ Add item</button>
    <datalist id="exit-directions">
      ${DIRECTIONS.map((d) => `<option value="${d}"></option>`).join('')}
    </datalist>
  `;

  $('#room-id').textContent = state.currentId;
  $('#description').value = state.draft.description || '';
  $('#desc-source').textContent = state.draft.descriptionFromData ? 'overrides code' : 'from code';

  $('#description').addEventListener('input', (e) => {
    state.draft.description = e.target.value;
    state.draft.descriptionFromData = true;
    $('#desc-source').textContent = 'overrides code';
    renderRoomList();
  });

  renderColor();
  renderImage();

  renderExits();
  renderItems();
  renderHistory();

  $('#save').addEventListener('click', save);
  $('#revert').addEventListener('click', revert);
  $('#add-exit').addEventListener('click', () => {
    state.draft.exits.push({ name: '', to: '', source: 'data' });
    renderExits();
    renderRoomList();
  });
  $('#add-item').addEventListener('click', () => {
    state.draft.items.push({ itemId: '', spawnSeconds: 60 });
    renderItems();
    renderRoomList();
  });
}

// Translate any string the server might serve (CSS name, '#rgb', '#rrggbb')
// into a #rrggbb hex the <input type=color> understands. Returns null if the
// value isn't a recognisable hex — the picker stays at its previous value.
function colorToHex(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith('#')) return null;
  let hex = trimmed.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6 || /[^0-9a-f]/.test(hex)) return null;
  return '#' + hex;
}

function renderColor() {
  const enabled = $('#color-enabled');
  const picker = $('#color-picker');
  const text = $('#color-text');
  const clearBtn = $('#color-clear');
  const source = $('#color-source');

  const current = state.draft.color;
  const isOn = current != null && current !== '';
  enabled.checked = isOn;
  text.value = isOn ? current : '';
  const asHex = colorToHex(current);
  if (asHex) picker.value = asHex;
  picker.disabled = !isOn;
  text.disabled = !isOn;
  source.textContent = state.draft.colorFromData
    ? 'overrides code'
    : (state.draft.codeColor ? 'from code' : '');

  const update = (value, fromData = true) => {
    state.draft.color = value;
    state.draft.colorFromData = fromData;
    renderColor();
    renderRoomList();
  };

  enabled.onchange = (e) => {
    if (e.target.checked) {
      update(state.draft.color || picker.value || '#ffffff');
    } else {
      update(null);
    }
  };
  picker.oninput = (e) => update(e.target.value);
  text.oninput = (e) => {
    state.draft.color = e.target.value;
    state.draft.colorFromData = true;
    const hex = colorToHex(e.target.value);
    if (hex) picker.value = hex;
    source.textContent = 'overrides code';
    renderRoomList();
  };
  clearBtn.onclick = () => update(null);
}

function renderImage() {
  const select = $('#image-select');
  const preview = $('#image-preview');
  const source = $('#image-source');
  if (!select) return;

  const known = state.images.map((im) => '/files/images/' + im.filename);
  const all = new Set(known);
  const value = state.draft.image || '';
  if (value) all.add(value);

  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '(none)';
  if (!value) blank.selected = true;
  select.appendChild(blank);
  for (const url of [...all].sort()) {
    const opt = document.createElement('option');
    opt.value = url;
    const isKnown = known.includes(url);
    opt.textContent = isKnown
      ? url.replace(/^\/files\/images\//, '')
      : url + ' (missing)';
    if (url === value) opt.selected = true;
    select.appendChild(opt);
  }

  if (value) { preview.src = value; preview.style.display = ''; }
  else { preview.removeAttribute('src'); preview.style.display = 'none'; }

  source.textContent = state.draft.imageFromData
    ? 'overrides code'
    : (state.draft.codeImage ? 'from code' : '');

  select.onchange = (e) => {
    state.draft.image = e.target.value || null;
    state.draft.imageFromData = true;
    renderImage();
    renderRoomList();
  };
}

function renderExits() {
  const container = $('#exits');
  container.innerHTML = '';
  const roomOptions = state.rooms.map((r) => r.id);
  state.draft.exits.forEach((exit, idx) => {
    const row = document.createElement('div');
    row.className = 'exit-row';
    // Include the current `to` even if it points to a room that no longer
    // exists, so the user can see and change it rather than silently losing it.
    const options = new Set(roomOptions);
    if (exit.to) options.add(exit.to);
    const optionsHtml = ['<option value="">(pick a room)</option>']
      .concat([...options].sort().map((id) =>
        `<option value="${escapeAttr(id)}"${id === exit.to ? ' selected' : ''}>${escapeAttr(id)}${
          roomOptions.includes(id) ? '' : ' (missing)'
        }</option>`
      ))
      .join('');
    row.innerHTML = `
      <input type="text" placeholder="direction" list="exit-directions"
             autocomplete="off" value="${escapeAttr(exit.name)}">
      <select class="to">${optionsHtml}</select>
      <button type="button">×</button>
    `;
    const nameInput = row.querySelector('input');
    const toSelect = row.querySelector('select.to');
    nameInput.addEventListener('input', (e) => {
      exit.name = e.target.value;
      renderRoomList();
    });
    toSelect.addEventListener('change', (e) => {
      exit.to = e.target.value;
      renderRoomList();
    });
    row.querySelector('button').addEventListener('click', () => {
      state.draft.exits.splice(idx, 1);
      renderExits();
      renderRoomList();
    });
    container.appendChild(row);
  });
}

function renderItems() {
  const container = $('#items');
  container.innerHTML = '';
  const itemOptions = state.items.map((it) => it.id);
  if (!itemOptions.length) {
    const note = document.createElement('div');
    note.className = 'empty';
    note.style.textAlign = 'left';
    note.style.padding = '0.5rem 0';
    note.textContent = 'No items defined yet. Create one as a data file: { "type": "item", "id": "...", "name": "...", "description": "..." }';
    container.appendChild(note);
  }
  state.draft.items.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'exit-row';
    const options = new Set(itemOptions);
    if (entry.itemId) options.add(entry.itemId);
    const optionsHtml = ['<option value="">(pick an item)</option>']
      .concat([...options].sort().map((id) => {
        const def = state.items.find((it) => it.id === id);
        const label = def && def.name && def.name !== id ? `${id} (${def.name})` : id;
        return `<option value="${escapeAttr(id)}"${id === entry.itemId ? ' selected' : ''}>${escapeAttr(label)}${
          itemOptions.includes(id) ? '' : ' (missing)'
        }</option>`;
      }))
      .join('');
    row.innerHTML = `
      <select class="item">${optionsHtml}</select>
      <span class="source">spawns every</span>
      <input type="number" class="freq" min="1" step="1" value="${escapeAttr(entry.spawnSeconds)}">
      <span class="source">sec</span>
      <button type="button">×</button>
    `;
    const itemSelect = row.querySelector('select.item');
    const freqInput = row.querySelector('input.freq');
    itemSelect.addEventListener('change', (e) => {
      entry.itemId = e.target.value;
      renderRoomList();
    });
    freqInput.addEventListener('input', (e) => {
      entry.spawnSeconds = parseInt(e.target.value, 10) || 0;
      renderRoomList();
    });
    row.querySelector('button').addEventListener('click', () => {
      state.draft.items.splice(idx, 1);
      renderItems();
      renderRoomList();
    });
    container.appendChild(row);
  });
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
    selectRoom(state.currentId, e.target.value);
  });
}

async function loadHistory(id) {
  const res = await fetch('/history/rooms/' + encodeURIComponent(id) + '.json');
  state.history = res.status === 200 ? await res.json() : [];
}

function buildOverlay() {
  // Only include exits that the user actually overrode or added. An exit
  // whose source is 'code' and value matches the code stays out of the file.
  const overlay = { type: 'room', id: state.currentId };

  if (state.draft.descriptionFromData) {
    overlay.description = state.draft.description;
  }

  if (state.draft.colorFromData) {
    overlay.color = state.draft.color;
  }

  if (state.draft.imageFromData) {
    overlay.image = state.draft.image || null;
  }

  const exits = {};
  for (const exit of state.draft.exits) {
    if (!exit.name) continue;
    const codeTo = state.draft.codeExits[exit.name];
    if (codeTo !== exit.to) {
      exits[exit.name] = exit.to;
    }
  }
  if (Object.keys(exits).length) overlay.exits = exits;

  const items = state.draft.items
    .filter((it) => it.itemId)
    .map((it) => ({ itemId: it.itemId, spawnSeconds: Math.max(1, it.spawnSeconds || 60) }));
  if (items.length) overlay.items = items;

  return overlay;
}

async function save() {
  const overlay = buildOverlay();
  const body = JSON.stringify(overlay, null, 2);
  const url = '/files/rooms/' + encodeURIComponent(state.currentId) + '.json';
  const res = await fetch(url, { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to save (${res.status}): ${await res.text()}`);
    return;
  }
  await Promise.all([loadRooms(), loadItems(), loadImages()]);
  await selectRoom(state.currentId);
}

async function revert() {
  if (isDirty() && !confirm('Discard unsaved changes?')) return;
  await selectRoom(state.currentId, state.selectedVersion);
}

async function newRoom() {
  const id = prompt('New room id?');
  if (!id) return;
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    alert('Room ids must be letters/numbers/dot/dash/underscore only.');
    return;
  }
  // Create a minimal stub data file so the loader picks it up immediately.
  // ?create=1 makes the server refuse if a room with that id already exists.
  const body = JSON.stringify({ type: 'room', id, description: 'A new room.' }, null, 2);
  const res = await fetch('/files/rooms/' + encodeURIComponent(id) + '.json?create=1', { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to create (${res.status}): ${await res.text()}`);
    return;
  }
  await loadRooms();
  await selectRoom(id);
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function loadFromUrl() {
  const bits = window.location.pathname.split('/').filter(Boolean);
  // /rooms or /rooms/<id>
  if (bits[0] === 'rooms' && bits[1]) {
    selectRoom(decodeURIComponent(bits[1]));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#new').addEventListener('click', newRoom);
  Promise.all([loadRooms(), loadItems(), loadImages()]).then(loadFromUrl);
  setInterval(() => { loadRooms(); loadItems(); loadImages(); }, 10000);
});
