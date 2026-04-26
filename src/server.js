import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { Loader } from './loader.js';

const app = express();
// Strict routing so `/rooms` (JSON list) and `/rooms/` (editor HTML) don't collide.
app.set('strict routing', true);
const server = http.createServer(app);
const io = new Server(server);
const port = parseInt(process.env.PORT || '8989', 10);
const WORLD_DIR = './world';
const NAME_RE = /^[a-zA-Z0-9._-]+$/;

const loader = new Loader(WORLD_DIR);
const { game } = loader;

const isValidName = (name) => typeof name === 'string' && NAME_RE.test(name);

// Two parallel folders under world/: `code` for JS modules and `data` for JSON
// overlays. Both are exposed through the same /files/:folder/... endpoints.
const FOLDERS = {
  code: {
    dir: `${WORLD_DIR}/code`,
    extension: '.js',
    validate: null,
  },
  data: {
    dir: `${WORLD_DIR}/data`,
    extension: '.json',
    validate: (buffer) => { JSON.parse(buffer.toString('utf8')); },
  },
};

const getFolder = (name) =>
  Object.hasOwn(FOLDERS, name) ? FOLDERS[name] : null;

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
  if (sourceContent.type !== 'room' || !sourceContent.exits) return;
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
// Handles both room and item overlays based on the parsed content's `type`.
function captureCodeState(folder, name, parsed) {
  const backupDir = `${folder.dir}/.backups`;
  if (fs.existsSync(`${backupDir}/${name}.1`)) return;
  const id = (parsed && parsed.id) || name.replace(/\.json$/i, '');
  const type = parsed && parsed.type;

  let codeState = null;
  if (type === 'room') {
    const room = game.rooms[id];
    if (!room || !room._codeProps) return;
    codeState = { type: 'room', id };
    if ('description' in room._codeProps) {
      codeState.description = room._codeProps.description;
    }
    const exits = { ...(room._codeProps.exits || {}) };
    if (Object.keys(exits).length) codeState.exits = exits;
  } else if (type === 'item') {
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
  if (!isValidName(name)) {
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
  res.end(fs.readFileSync(path));
});

app.put('/files/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name)) {
    res.status(404).end("I don't like the name");
    return;
  }
  let buffer = Buffer.alloc(0);
  req.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
  });
  req.on('end', () => {
    if (folder.validate) {
      try {
        folder.validate(buffer);
      } catch (e) {
        res.status(400).end(`Invalid file: ${e.message}`);
        return;
      }
    }
    const path = `${folder.dir}/${name}`;
    let parsed = null;
    if (folder === FOLDERS.data) {
      try { parsed = JSON.parse(buffer.toString('utf8')); } catch (e) { /* already validated */ }
    }
    if (folder === FOLDERS.data && !fs.existsSync(path)) {
      captureCodeState(folder, name, parsed);
    }
    backupFile(folder, name);
    fs.writeFileSync(path, buffer);
    if (folder === FOLDERS.data && parsed) {
      ensureInverseExits(folder, parsed);
    }
    loader.update();
    res.status(201).end('');
  });
});

app.delete('/files/:folder/:filename', (req, res) => {
  const folder = getFolder(req.params.folder);
  if (!folder) { res.status(404).end('Unknown folder'); return; }
  const name = req.params.filename;
  if (!isValidName(name)) {
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
  if (!isValidName(name)) {
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
  if (!isValidName(name)) {
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
      items: (r.items || []).map((it) => ({ name: it.name, short: it.short })),
      hasData: fs.existsSync(`${FOLDERS.data.dir}/${r.id}.json`),
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
      hasData: fs.existsSync(`${FOLDERS.data.dir}/${it.id}.json`),
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

app.get('/rooms/:id', (req, res) => {
  fs.createReadStream('./client/roomeditor.html').pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`listening on *:${port}`);
});
