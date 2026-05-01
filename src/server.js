import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { marked } from 'marked';
import { Loader } from './loader.js';

const app = express();
// Strict routing so `/rooms` (JSON list) and `/rooms/` (editor HTML) don't collide.
app.set('strict routing', true);
const server = http.createServer(app);
const io = new Server(server);
const port = parseInt(process.env.PORT || '8989', 10);
const WORLD_DIR = './world';
// Filenames must start with an alphanumeric/underscore/hyphen (no leading dot,
// so no `.gitignore`/`..`) and contain only the same set plus dots. The
// extension is checked per-folder by `isValidName`.
const NAME_RE = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/;
const MAX_UPLOAD_BYTES = 128 * 1024;

const loader = new Loader(WORLD_DIR);
const { game } = loader;

const isValidName = (name, folder) => {
  if (typeof name !== 'string' || !NAME_RE.test(name)) return false;
  if (folder && !name.toLowerCase().endsWith(folder.extension)) return false;
  return true;
};

// Folders under world/: `code` for JS modules; `rooms` and `items` for JSON
// data overlays (one subfolder each so a room and an item can share an id
// without colliding); `images` for PNG pixel art the world references.
// All exposed via the same /files/:folder/... endpoints.
const jsonValidate = (buffer) => { JSON.parse(buffer.toString('utf8')); };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngValidate = (buffer) => {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file');
  }
};
const FOLDERS = {
  code: {
    dir: `${WORLD_DIR}/code`,
    extension: '.js',
    validate: null,
    kind: 'code',
    label: 'file',
  },
  rooms: {
    dir: `${WORLD_DIR}/data/rooms`,
    extension: '.json',
    validate: jsonValidate,
    kind: 'room',
    label: 'room',
  },
  items: {
    dir: `${WORLD_DIR}/data/items`,
    extension: '.json',
    validate: jsonValidate,
    kind: 'item',
    label: 'item',
  },
  images: {
    dir: `${WORLD_DIR}/images`,
    extension: '.png',
    validate: pngValidate,
    kind: 'image',
    label: 'image',
    mime: 'image/png',
  },
};

const getFolder = (name) =>
  Object.hasOwn(FOLDERS, name) ? FOLDERS[name] : null;

// One-time migration: legacy data files lived in world/data/*.json with their
// kind in a `type` field. Move each into the appropriate subfolder so the
// rooms and items namespaces are now separate on disk.
function migrateLegacyDataFiles() {
  const legacyDir = `${WORLD_DIR}/data`;
  if (!fs.existsSync(legacyDir)) return;

  const moveByType = (filePath, filename, isBackup) => {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return;
    }
    const target = parsed.type === 'item' ? FOLDERS.items
                  : parsed.type === 'room' ? FOLDERS.rooms
                  : null;
    if (!target) return;
    const destDir = isBackup ? `${target.dir}/.backups` : target.dir;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destPath = `${destDir}/${filename}`;
    if (fs.existsSync(destPath)) return; // don't clobber if already migrated
    fs.renameSync(filePath, destPath);
    console.log(`Migrated ${isBackup ? '.backups/' : ''}${filename} → ${target.kind}s/`);
  };

  for (const f of fs.readdirSync(legacyDir)) {
    if (!f.endsWith('.json')) continue;
    const fullPath = `${legacyDir}/${f}`;
    if (!fs.statSync(fullPath).isFile()) continue;
    moveByType(fullPath, f, false);
  }

  const legacyBackups = `${legacyDir}/.backups`;
  if (fs.existsSync(legacyBackups)) {
    for (const bf of fs.readdirSync(legacyBackups)) {
      if (!/^.+\.json\.\d+$/.test(bf)) continue;
      moveByType(`${legacyBackups}/${bf}`, bf, true);
    }
  }
}

migrateLegacyDataFiles();
for (const folder of Object.values(FOLDERS)) {
  if (!fs.existsSync(folder.dir)) fs.mkdirSync(folder.dir, { recursive: true });
}

function backupFile(folder, name) {
  const path = `${folder.dir}/${name}`;
  if (!fs.existsSync(path)) return;
  const backupDir = `${folder.dir}/.backups`;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  for (let i = 1; ; i++) {
    const backupPath = `${backupDir}/${name}.${i}`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(path, backupPath);
      break;
    }
  }
}

const COMPASS_INVERSES = {
  north: 'south', south: 'north',
  east: 'west', west: 'east',
  northeast: 'southwest', southwest: 'northeast',
  northwest: 'southeast', southeast: 'northwest',
};

// When a room data overlay introduces a compass-direction exit, make sure the
// target room has the inverse exit pointing back. Skips when the target
// already has an exit in that direction (from code or another overlay) so we
// never overwrite an intentional one-way passage.
function ensureInverseExits(folder, sourceContent) {
  if (folder.kind !== 'room' || !sourceContent.exits) return;
  const sourceId = sourceContent.id;
  if (!sourceId) return;
  for (const [dir, targetId] of Object.entries(sourceContent.exits)) {
    const inverse = COMPASS_INVERSES[dir];
    if (!inverse || !targetId) continue;
    const target = game.rooms[targetId];
    if (target && target.exits && target.exits[inverse]) continue;
    if (!isValidName(targetId)) continue;
    const targetName = `${targetId}.json`;
    const targetPath = `${folder.dir}/${targetName}`;
    let targetData = { type: 'room', id: targetId };
    if (fs.existsSync(targetPath)) {
      try {
        targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      } catch (e) { /* fall through with default stub */ }
    }
    targetData.exits = targetData.exits || {};
    if (targetData.exits[inverse]) continue;
    targetData.exits[inverse] = sourceId;
    captureCodeState(folder, targetName, targetData);
    backupFile(folder, targetName);
    fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2));
  }
}

// First time a code-defined entity gets a data overlay, snapshot its code-only
// state into the backup history so the user can revert back to "no overlay".
function captureCodeState(folder, name, parsed) {
  const backupDir = `${folder.dir}/.backups`;
  if (fs.existsSync(`${backupDir}/${name}.1`)) return;
  const id = (parsed && parsed.id) || name.replace(/\.json$/i, '');

  let codeState = null;
  if (folder.kind === 'room') {
    const room = game.rooms[id];
    if (!room || !room._codeProps) return;
    codeState = { type: 'room', id };
    if ('description' in room._codeProps) {
      codeState.description = room._codeProps.description;
    }
    if ('color' in room._codeProps) {
      codeState.color = room._codeProps.color;
    }
    if ('image' in room._codeProps) {
      codeState.image = room._codeProps.image;
    }
    const exits = { ...(room._codeProps.exits || {}) };
    if (Object.keys(exits).length) codeState.exits = exits;
  } else if (folder.kind === 'item') {
    const item = game.items[id];
    if (!item || !item._codeProps) return;
    codeState = { type: 'item', id };
    for (const [key, value] of Object.entries(item._codeProps)) {
      if (key === 'type' || key === 'id') continue;
      codeState[key] = value;
    }
  }

  if (!codeState) return;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  fs.writeFileSync(`${backupDir}/${name}.1`, JSON.stringify(codeState, null, 2));
}

// Serve the index.html as the root
app.get('/', (req, res) => {
  fs.createReadStream('./client/index.html').pipe(res);
});

// Serve static files: js and css
app.use('/', express.static('./client'));

io.sockets.on('connection', (socket) => {
  socket.on('login', (name) => {
    if (!isValidName(name)) {
      socket.emit('write', {
        string: 'NICE TRY. Try picking a name without spaces or special characters.',
      });
      return;
    }
    const player = game.createPlayer(name);
    player.on('write', (string) => socket.emit('write', string));
    socket.on('command', (command) => {
      if (command) player.execute(command);
    });
    player.execute('look');
    game.emit('enterRoom', player, player.getCurrentRoom(), game);
    socket.on('disconnect', () => {
      delete game.players[player.name];
    });
  });
});

app.get('/files/:folder/', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  res.setHeader('Content-Type', 'application/json');

  const output = [];
  if (fs.existsSync(folder.dir)) {
    for (const f of fs.readdirSync(folder.dir)) {
      if (f[0] === '.') continue;
      const errorPath = `${folder.dir}/.errors/${f}`;
      const error = fs.existsSync(errorPath)
        ? fs.readFileSync(errorPath, { encoding: 'utf-8' })
        : null;
      const entry = { filename: f, error };
      // For JSON data files, surface the type/id so the client can group them.
      if (f.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(fs.readFileSync(`${folder.dir}/${f}`, 'utf8'));
          entry.type = parsed.type;
          entry.id = parsed.id;
        } catch (e) {
          // Leave type/id undefined; the error file (if any) explains it.
        }
      }
      output.push(entry);
    }
  }
  output.sort((a, b) => a.filename.localeCompare(b.filename));
  res.end(JSON.stringify(output));
});

app.get('/files/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name, folder)) {
    res.status(404).end("I don't like the name");
    return;
  }

  let path = `${folder.dir}/${name}`;
  if (req.query.version) {
    path = `${folder.dir}/.backups/${name}.${parseInt(req.query.version, 10)}`;
  }
  if (!fs.existsSync(path)) {
    res.status(404).end('Not found');
    return;
  }
  if (folder.mime) res.setHeader('Content-Type', folder.mime);
  res.end(fs.readFileSync(path));
});

app.put('/files/:folder/:filename', express.raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }), (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name, folder)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const path = `${folder.dir}/${name}`;
  // ?create=1 means "I'm making a new one" — refuse if it's already there.
  if (req.query.create === '1' && fs.existsSync(path)) {
    const extRe = new RegExp(folder.extension.replace(/\./g, '\\.') + '$', 'i');
    const id = name.replace(extRe, '');
    res.status(409).end(`A ${folder.label} called "${id}" already exists.`);
    return;
  }
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (folder.validate) {
    try {
      folder.validate(buffer);
    } catch (e) {
      res.status(400).end(`Invalid file: ${e.message}`);
      return;
    }
  }
  const isData = folder.kind === 'room' || folder.kind === 'item';
  let parsed = null;
  if (isData) {
    try { parsed = JSON.parse(buffer.toString('utf8')); } catch (e) { /* already validated */ }
  }
  if (isData && !fs.existsSync(path)) {
    captureCodeState(folder, name, parsed);
  }
  backupFile(folder, name);
  fs.writeFileSync(path, buffer);
  if (isData && parsed) {
    ensureInverseExits(folder, parsed);
  }
  loader.update();
  res.status(201).end('');
});

app.delete('/files/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name, folder)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const path = `${folder.dir}/${name}`;
  if (!fs.existsSync(path)) {
    res.status(404).end('Not found');
    return;
  }
  backupFile(folder, name);
  fs.unlinkSync(path);
  loader.update();
  res.status(201).end('');
});

app.get('/history/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name, folder)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const history = [];
  for (let i = 1; ; i++) {
    const backupPath = `${folder.dir}/.backups/${name}.${i}`;
    if (!fs.existsSync(backupPath)) break;
    history.unshift({ version: i, mtime: fs.statSync(backupPath).mtime });
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(history));
});

app.get('/logs/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name, folder)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const path = `${folder.dir}/.logs/${name}`;
  if (fs.existsSync(path)) {
    res.end(fs.readFileSync(path));
  } else {
    res.end('');
  }
});

app.get('/edit/', (req, res) => {
  fs.createReadStream('./client/editfile.html').pipe(res);
});

app.get('/edit/:filename', (req, res) => {
  fs.createReadStream('./client/editfile.html').pipe(res);
});

// List every room currently known to the running game (from code + data).
// `exits`/`description` are the merged state; `codeExits`/`codeDescription`
// expose just what the JS module provided so the editor can tell them apart.
app.get('/rooms', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const rooms = Object.values(game.rooms).map((r) => {
    const code = r._codeProps || {};
    return {
      id: r.id,
      description: r.description,
      codeDescription: 'description' in code ? code.description : null,
      exits: { ...r.exits },
      codeExits: { ...(code.exits || {}) },
      color: r.color || null,
      codeColor: 'color' in code ? code.color : null,
      image: r.image || null,
      codeImage: 'image' in code ? code.image : null,
      items: (r.items || []).map((it) => ({ name: it.name, short: it.short })),
      hasData: fs.existsSync(`${FOLDERS.rooms.dir}/${r.id}.json`),
    };
  });
  rooms.sort((a, b) => a.id.localeCompare(b.id));
  res.end(JSON.stringify(rooms));
});

// List every item known to the running game (from code or data overlays).
// `code*` fields expose the JS-provided values so the editor can show what
// would be in effect without an overlay.
app.get('/items', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const items = Object.values(game.items).map((it) => {
    const code = it._codeProps || {};
    return {
      id: it.id,
      name: it.name,
      description: it.description,
      short: it.short,
      image: it.image,
      gettable: it.gettable !== false,
      codeName: 'name' in code ? code.name : null,
      codeDescription: 'description' in code ? code.description : null,
      codeShort: 'short' in code ? code.short : null,
      codeImage: 'image' in code ? code.image : null,
      codeGettable: 'gettable' in code ? code.gettable : null,
      hasData: fs.existsSync(`${FOLDERS.items.dir}/${it.id}.json`),
    };
  });
  items.sort((a, b) => a.id.localeCompare(b.id));
  res.end(JSON.stringify(items));
});

app.get('/items/', (req, res) => {
  fs.createReadStream('./client/itemeditor.html').pipe(res);
});

app.get('/items/:id', (req, res) => {
  fs.createReadStream('./client/itemeditor.html').pipe(res);
});

app.get('/rooms/', (req, res) => {
  fs.createReadStream('./client/roomeditor.html').pipe(res);
});

app.get('/images/', (req, res) => {
  fs.createReadStream('./client/imageeditor.html').pipe(res);
});

app.get('/images/:id', (req, res) => {
  fs.createReadStream('./client/imageeditor.html').pipe(res);
});

const DOCS_DIR = './docs';
const DOCS_NAME_RE = /^[a-zA-Z0-9_-]+\.md$/;

function renderDocPage(title, bodyHtml, currentSlug, rawMarkdown) {
  const links = fs.existsSync(DOCS_DIR)
    ? fs.readdirSync(DOCS_DIR)
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .sort()
        .map((f) => {
          const slug = f.replace(/\.md$/, '');
          const cls = slug === currentSlug ? ' class="active"' : '';
          return `<li><a href="/docs/${slug}"${cls}>${slug}</a></li>`;
        })
        .join('')
    : '';
  const homeCls = currentSlug == null ? ' class="active"' : '';
  // JSON-encode the raw markdown so it survives any characters; escape `</`
  // so a literal "</script>" inside the markdown can't break out.
  const mdJson = JSON.stringify(rawMarkdown).replace(/<\//g, '<\\/');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title} — Nodeventure docs</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; display: flex; min-height: 100vh; }
  nav { background: #1a1a1a; color: #ccc; padding: 16px 20px; min-width: 180px; }
  nav h2 { color: white; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px; }
  nav ul { list-style: none; padding: 0; margin: 0; }
  nav li { margin: 6px 0; }
  nav a { color: #6c6; text-decoration: none; }
  nav a:hover { color: white; }
  nav a.active { color: white; font-weight: bold; }
  nav .copy-all {
    margin-top: 24px; width: 100%;
    background: transparent; color: #6c6; border: 1px solid #6c6;
    padding: 8px 10px; border-radius: 4px; font: inherit; font-size: 12px;
    cursor: pointer; text-align: left;
  }
  nav .copy-all:hover { background: #6c6; color: #1a1a1a; }
  nav .copy-all.copied { background: #6c6; color: #1a1a1a; }
  main { flex: 1; padding: 24px 40px; max-width: 820px; line-height: 1.55; color: #222; position: relative; }
  h1, h2, h3 { color: #111; }
  h1 { border-bottom: 2px solid #6c6; padding-bottom: 8px; }
  h3 { margin-top: 28px; }
  code { background: #f4f4f4; padding: 1px 5px; border-radius: 3px; font-size: 0.95em; }
  pre { background: #f4f4f4; padding: 12px 16px; border-radius: 4px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
  th { background: #f0f0f0; }
  a { color: #060; }
  #copy-md {
    position: absolute; top: 24px; right: 40px;
    background: #1a1a1a; color: #6c6; border: 1px solid #6c6;
    padding: 6px 12px; border-radius: 4px; font: inherit; font-size: 13px;
    cursor: pointer;
  }
  #copy-md:hover { background: #6c6; color: #1a1a1a; }
  #copy-md.copied { background: #6c6; color: #1a1a1a; border-color: #6c6; }
</style>
</head><body>
<nav>
  <h2>Docs</h2>
  <ul>
    <li><a href="/docs/"${homeCls}>index</a></li>
    ${links}
  </ul>
  <button id="copy-all" class="copy-all" type="button">Copy all docs as Markdown</button>
</nav>
<main>
  <button id="copy-md" type="button">Copy as Markdown</button>
  ${bodyHtml}
</main>
<script id="raw-md" type="application/json">${mdJson}</script>
<script>
  (function () {
    function flash(btn, label, original) {
      var origText = original;
      btn.textContent = label;
      btn.classList.add('copied');
      setTimeout(function () {
        btn.textContent = origText;
        btn.classList.remove('copied');
      }, 1500);
    }

    var btn = document.getElementById('copy-md');
    var md = JSON.parse(document.getElementById('raw-md').textContent);
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(md).then(function () {
        flash(btn, 'Copied!', 'Copy as Markdown');
      }, function () {
        flash(btn, 'Copy failed', 'Copy as Markdown');
      });
    });

    var allBtn = document.getElementById('copy-all');
    allBtn.addEventListener('click', function () {
      fetch('/docs/all.md').then(function (r) { return r.text(); }).then(function (text) {
        return navigator.clipboard.writeText(text);
      }).then(function () {
        flash(allBtn, 'Copied!', 'Copy all docs as Markdown');
      }, function () {
        flash(allBtn, 'Copy failed', 'Copy all docs as Markdown');
      });
    });
  })();
</script>
</body></html>`;
}

function buildAllDocsMarkdown() {
  if (!fs.existsSync(DOCS_DIR)) return '';
  const files = fs.readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    // README first, then alphabetical.
    .sort((a, b) => {
      if (a === 'README.md') return -1;
      if (b === 'README.md') return 1;
      return a.localeCompare(b);
    });
  return files
    .map((f) => `<!-- ${f} -->\n\n${fs.readFileSync(`${DOCS_DIR}/${f}`, 'utf8').trim()}`)
    .join('\n\n---\n\n') + '\n';
}

app.get('/docs/', (req, res) => {
  const path = `${DOCS_DIR}/README.md`;
  if (!fs.existsSync(path)) { res.status(404).end('No docs'); return; }
  const raw = fs.readFileSync(path, 'utf8');
  const html = marked.parse(raw)
    .replace(/href="([a-zA-Z0-9_-]+)\.md(#[^"]*)?"/g, 'href="/docs/$1$2"');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderDocPage('Index', html, null, raw));
});

// Must come before /docs/:name so it isn't shadowed.
app.get('/docs/all.md', (req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.end(buildAllDocsMarkdown());
});

app.get('/docs/:name', (req, res) => {
  const name = req.params.name;
  // Allow links to be /docs/foo or /docs/foo.md
  const slug = name.replace(/\.md$/i, '');
  const filename = `${slug}.md`;
  if (!DOCS_NAME_RE.test(filename)) { res.status(404).end('Not found'); return; }
  const path = `${DOCS_DIR}/${filename}`;
  if (!fs.existsSync(path)) { res.status(404).end('Not found'); return; }
  const raw = fs.readFileSync(path, 'utf8');
  const html = marked.parse(raw)
    // Rewrite cross-doc relative links so .md becomes /docs/<slug>
    .replace(/href="([a-zA-Z0-9_-]+)\.md(#[^"]*)?"/g, 'href="/docs/$1$2"');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderDocPage(slug, html, slug, raw));
});

app.get('/rooms/:id', (req, res) => {
  fs.createReadStream('./client/roomeditor.html').pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`listening on *:${port}`);
});
