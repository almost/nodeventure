import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { Loader } from './loader.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = parseInt(process.env.PORT || '8989', 10);
const WORLD_DIR = './world';
const NAME_RE = /^[a-zA-Z0-9._-]+$/;

const loader = new Loader(WORLD_DIR);
const { game } = loader;

const isValidName = (name) => typeof name === 'string' && NAME_RE.test(name);

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

// Code editor
app.get('/files/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const output = [];
  for (const f of fs.readdirSync(WORLD_DIR)) {
    if (f[0] === '.') continue;
    const errorPath = `${WORLD_DIR}/.errors/${f}`;
    const error = fs.existsSync(errorPath)
      ? fs.readFileSync(errorPath, { encoding: 'utf-8' })
      : null;
    output.push({ filename: f, error });
  }

  output.sort((a, b) => a.filename.localeCompare(b.filename));
  res.end(JSON.stringify(output));
});

app.get('/files/:filename', (req, res) => {
  const name = req.params.filename;
  if (!isValidName(name)) {
    res.status(404).end("I don't like the name");
    return;
  }

  let path = `${WORLD_DIR}/${name}`;
  if (req.query.version) {
    path = `${WORLD_DIR}/.backups/${name}.${parseInt(req.query.version, 10)}`;
  }
  res.end(fs.readFileSync(path));
});

function backupWorldFile(name) {
  const path = `${WORLD_DIR}/${name}`;
  if (!fs.existsSync(path)) return;
  if (!fs.existsSync(`${WORLD_DIR}/.backups`)) {
    fs.mkdirSync(`${WORLD_DIR}/.backups`);
  }
  for (let i = 1; ; i++) {
    const backupPath = `${WORLD_DIR}/.backups/${name}.${i}`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(path, backupPath);
      break;
    }
  }
}

app.put('/files/:filename', (req, res) => {
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
    backupWorldFile(name);
    fs.writeFileSync(`${WORLD_DIR}/${name}`, buffer, { encoding: 'binary' });
    loader.update();
    res.status(201).end('');
  });
});

app.delete('/files/:filename', (req, res) => {
  const name = req.params.filename;
  if (!isValidName(name)) {
    res.status(404).end("I don't like the name");
    return;
  }

  backupWorldFile(name);
  fs.unlinkSync(`${WORLD_DIR}/${name}`);
  res.status(201).end('');
});

app.get('/edit/', (req, res) => {
  fs.createReadStream('./client/editfile.html').pipe(res);
});

app.get('/edit/:filename', (req, res) => {
  fs.createReadStream('./client/editfile.html').pipe(res);
});

app.get('/history/:filename', (req, res) => {
  const name = req.params.filename;
  if (!isValidName(name)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const history = [];
  for (let i = 1; ; i++) {
    const backupPath = `${WORLD_DIR}/.backups/${name}.${i}`;
    if (!fs.existsSync(backupPath)) break;
    history.unshift({ version: i, mtime: fs.statSync(backupPath).mtime });
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(history));
});

app.get('/logs/:filename', (req, res) => {
  const name = req.params.filename;
  if (!isValidName(name)) {
    res.status(404).end("I don't like the name");
    return;
  }
  const path = `${WORLD_DIR}/.logs/${name}`;
  if (fs.existsSync(path)) {
    res.end(fs.readFileSync(path));
  } else {
    res.end('');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`listening on *:${port}`);
});
