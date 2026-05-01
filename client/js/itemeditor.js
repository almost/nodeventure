// Item editor: list items on the left, edit fields on the right. Saves
// create / overwrite world/data/items/<id>.json overlays the loader applies
// on top of the code-defined item.

const state = {
  items: [],          // list from /items
  currentId: null,
  draft: null,        // editable copy
  initial: null,
  history: [],
  selectedVersion: 'current',
};

const $ = (sel) => document.querySelector(sel);

// Editable fields. `code*` keys on the /items entry give us the code-only
// value so the editor knows whether the user has overridden each field.
const FIELDS = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'display name (defaults to id)' },
  { key: 'short', label: 'Short', type: 'text', placeholder: 'e.g. "a tart yellow lemon"' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'image', label: 'Image URL', type: 'url' },
  { key: 'gettable', label: 'Gettable', type: 'checkbox' },
];

async function loadItems() {
  const res = await fetch('/items');
  state.items = await res.json();
  renderItemList();
}

function renderItemList() {
  const list = $('#room-list');
  list.innerHTML = '';
  for (const item of state.items) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = item.id;
    if (item.id === state.currentId) button.classList.add('active');
    if (item.hasData) {
      const badge = document.createElement('span');
      badge.className = 'badge data';
      badge.textContent = 'data';
      button.appendChild(badge);
    }
    if (state.currentId === item.id && isDirty()) {
      const star = document.createElement('span');
      star.className = 'changed';
      star.textContent = ' *';
      button.appendChild(star);
    }
    button.addEventListener('click', () => selectItem(item.id));
    li.appendChild(button);
    list.appendChild(li);
  }
}

async function selectItem(id, version = 'current') {
  if (isDirty() && id !== state.currentId) {
    if (!confirm('You have unsaved changes. Discard them?')) return;
  }
  state.currentId = id;
  state.selectedVersion = version;
  await loadItemDraft(id, version);
  await loadHistory(id);
  renderEditor();
  renderItemList();
  history.replaceState(null, '', '/items/' + encodeURIComponent(id));
}

async function loadItemDraft(id, version) {
  const item = state.items.find((it) => it.id === id);

  let dataContent = null;
  let url = '/files/items/' + encodeURIComponent(id) + '.json';
  if (version !== 'current') url += '?version=' + version;
  const res = await fetch(url);
  if (res.status === 200) {
    try { dataContent = await res.json(); } catch (e) { dataContent = null; }
  }

  // For each field: if data overlay has it, use that and mark as overlay-owned.
  // Otherwise fall back to the live value (which equals code when no overlay).
  const draft = { fields: {}, fromData: {} };
  for (const f of FIELDS) {
    if (dataContent && f.key in dataContent) {
      draft.fields[f.key] = dataContent[f.key];
      draft.fromData[f.key] = true;
    } else if (item) {
      draft.fields[f.key] = item[f.key];
      draft.fromData[f.key] = false;
    } else {
      draft.fields[f.key] = '';
      draft.fromData[f.key] = false;
    }
  }
  state.draft = draft;
  state.initial = JSON.stringify(draft);
}

function isDirty() {
  return state.draft && JSON.stringify(state.draft) !== state.initial;
}

function renderEditor() {
  const editor = $('#editor');
  if (!state.currentId) {
    editor.innerHTML = '<div class="empty">Pick an item on the left, or create a new one.</div>';
    return;
  }
  const item = state.items.find((it) => it.id === state.currentId);
  const fieldsHtml = FIELDS.map((f) => {
    const value = state.draft.fields[f.key];
    const sourceLabel = `<span class="badge" data-source="${f.key}"></span>`;
    if (f.type === 'textarea') {
      return `
        <label>${f.label} ${sourceLabel}</label>
        <textarea data-field="${f.key}" placeholder="${escapeAttr(f.placeholder || '')}">${escapeAttr(value)}</textarea>
      `;
    }
    if (f.type === 'checkbox') {
      const checked = value === false ? '' : 'checked';
      return `
        <div class="checkbox-row">
          <input type="checkbox" data-field="${f.key}" id="field-${f.key}" ${checked}>
          <label for="field-${f.key}" style="margin-top:0">${f.label} ${sourceLabel}</label>
        </div>
      `;
    }
    return `
      <label>${f.label} ${sourceLabel}</label>
      <input type="${f.type}" data-field="${f.key}" placeholder="${escapeAttr(f.placeholder || '')}" value="${escapeAttr(value)}">
    `;
  }).join('');

  editor.innerHTML = `
    <div id="toolbar">
      <h2 id="item-id"></h2>
      <select id="version"></select>
      <button id="save">Save</button>
      <button id="revert">Revert</button>
    </div>
    ${fieldsHtml}
  `;

  $('#item-id').textContent = state.currentId;
  for (const f of FIELDS) {
    updateSourceBadge(f.key);
    const el = editor.querySelector(`[data-field="${f.key}"]`);
    if (!el) continue;
    if (f.type === 'checkbox') {
      el.addEventListener('change', () => {
        state.draft.fields[f.key] = el.checked;
        state.draft.fromData[f.key] = true;
        updateSourceBadge(f.key);
        renderItemList();
      });
    } else {
      el.addEventListener('input', () => {
        state.draft.fields[f.key] = el.value;
        state.draft.fromData[f.key] = true;
        updateSourceBadge(f.key);
        renderItemList();
      });
    }
  }

  renderHistory();
  $('#save').addEventListener('click', save);
  $('#revert').addEventListener('click', revert);

  if (!item) {
    // Brand-new item, no live entry yet — nothing extra to show.
  }
}

function updateSourceBadge(fieldKey) {
  const badge = document.querySelector(`[data-source="${fieldKey}"]`);
  if (!badge) return;
  badge.textContent = state.draft.fromData[fieldKey] ? 'overrides code' : 'from code';
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
    selectItem(state.currentId, e.target.value);
  });
}

async function loadHistory(id) {
  const res = await fetch('/history/items/' + encodeURIComponent(id) + '.json');
  state.history = res.status === 200 ? await res.json() : [];
}

function buildOverlay() {
  const overlay = { type: 'item', id: state.currentId };
  for (const f of FIELDS) {
    if (!state.draft.fromData[f.key]) continue;
    overlay[f.key] = state.draft.fields[f.key];
  }
  return overlay;
}

async function save() {
  const overlay = buildOverlay();
  const body = JSON.stringify(overlay, null, 2);
  const url = '/files/items/' + encodeURIComponent(state.currentId) + '.json';
  const res = await fetch(url, { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to save (${res.status}): ${await res.text()}`);
    return;
  }
  await loadItems();
  await selectItem(state.currentId);
}

async function revert() {
  if (isDirty() && !confirm('Discard unsaved changes?')) return;
  await selectItem(state.currentId, state.selectedVersion);
}

async function newItem() {
  const id = prompt('New item id?');
  if (!id) return;
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    alert('Item ids must be letters/numbers/dot/dash/underscore only.');
    return;
  }
  // ?create=1 makes the server refuse if an item with that id already exists.
  const body = JSON.stringify({ type: 'item', id, name: id, description: 'A new item.' }, null, 2);
  const res = await fetch('/files/items/' + encodeURIComponent(id) + '.json?create=1', { method: 'PUT', body });
  if (res.status !== 201) {
    alert(`Failed to create (${res.status}): ${await res.text()}`);
    return;
  }
  await loadItems();
  await selectItem(id);
}

function escapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function loadFromUrl() {
  const bits = window.location.pathname.split('/').filter(Boolean);
  if (bits[0] === 'items' && bits[1]) {
    selectItem(decodeURIComponent(bits[1]));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#new').addEventListener('click', newItem);
  loadItems().then(loadFromUrl);
  setInterval(loadItems, 10000);
});
