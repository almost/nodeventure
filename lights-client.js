/* Blinkstick daemon. Listens to the Nodeventure server for `lights` events
 * and drives the LED strip. Runs in the macOS console user's GUI session
 * (launched from chrome-kiosk.command) so it has TCC permission to open
 * the HID device — the server itself can therefore be started over SSH
 * without HID access.
 *
 * Connects to NODEVENTURE_URL (default http://127.0.0.1:8989). socket.io
 * handles reconnection automatically.
 */
import { io as ioClient } from 'socket.io-client';
import { findFirstAsync } from '@ginden/blinkstick-v2';

const URL = process.env.NODEVENTURE_URL || 'http://127.0.0.1:8989';
const FADE_INTERVAL_MS = 30;

let blinkstick = null;
let connecting = null;
const fades = new Map();      // key → { from, to, start, end, current }
const lastColors = new Map(); // key → last RGB tuple written
let timer = null;

async function ensureDevice() {
  if (blinkstick || connecting) return connecting;
  connecting = findFirstAsync()
    .then((bs) => {
      blinkstick = bs;
      console.log(`Blinkstick connected (${bs.ledCount} LEDs).`);
    })
    .catch(() => {
      console.log('No Blinkstick found; will retry on next event.');
    })
    .finally(() => { connecting = null; });
  return connecting;
}

function write(key, tuple) {
  lastColors.set(key, [...tuple]);
  if (!blinkstick) return;
  try {
    if (key === 'all') {
      blinkstick.leds().setColor(tuple).catch(() => {});
    } else {
      const [r, g, b] = tuple;
      blinkstick.led(key).setColor(r, g, b).catch(() => {});
    }
  } catch (e) {
    // Swallow transient HID errors so a bad write doesn't kill the daemon.
  }
}

function startTimer() {
  if (timer) return;
  timer = setInterval(tick, FADE_INTERVAL_MS);
}

function tick() {
  if (fades.size === 0) {
    clearInterval(timer);
    timer = null;
    return;
  }
  const now = Date.now();
  for (const [key, f] of fades) {
    const span = Math.max(1, f.end - f.start);
    const t = Math.min(1, (now - f.start) / span);
    const r = (f.from[0] + (f.to[0] - f.from[0]) * t) | 0;
    const g = (f.from[1] + (f.to[1] - f.from[1]) * t) | 0;
    const b = (f.from[2] + (f.to[2] - f.from[2]) * t) | 0;
    f.current = [r, g, b];
    write(key, f.current);
    if (t >= 1) fades.delete(key);
  }
}

async function applyLights(payload) {
  if (!payload || !Array.isArray(payload.color)) return;
  await ensureDevice();
  if (!blinkstick) return;

  const tuple = payload.color;
  const fadeMs = payload.fadeMs > 0 ? payload.fadeMs : 0;
  const ledCount = blinkstick.ledCount || 0;
  const isAll = payload.ledIndex == null;
  const i = isAll ? null : (payload.ledIndex | 0);
  if (!isAll && (i < 0 || i >= ledCount)) return;
  const key = isAll ? 'all' : i;

  // Whole-strip writes supersede in-flight per-LED fades.
  if (isAll) {
    for (const k of [...fades.keys()]) {
      if (k !== 'all') fades.delete(k);
    }
  }

  if (!fadeMs) {
    fades.delete(key);
    write(key, tuple);
    return;
  }

  const existing = fades.get(key);
  const from = existing ? existing.current : (lastColors.get(key) || [0, 0, 0]);
  const now = Date.now();
  fades.set(key, {
    from: [...from],
    to: [...tuple],
    start: now,
    end: now + fadeMs,
    current: [...from],
  });
  startTimer();
}

ensureDevice();

const socket = ioClient(URL, { reconnection: true });
socket.on('connect', () => console.log(`Connected to ${URL}.`));
socket.on('disconnect', () => console.log('Disconnected, will reconnect…'));
socket.on('connect_error', (err) => console.log(`Connect error: ${err.message}`));
socket.on('lights', applyLights);

function shutdown() {
  console.log('Shutting down, fading to black.');
  if (blinkstick) {
    try { blinkstick.leds().setColor([0, 0, 0]).catch(() => {}); } catch (e) {}
  }
  socket.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
