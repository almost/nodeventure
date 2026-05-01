/* Host-side wrapper around an optional Blinkstick LED strip.
 *
 * The hardware is optional: if no device is connected, `set()` is a no-op so
 * world code can call `lights('red')` unconditionally. Connection happens
 * lazily on first use and is retried on subsequent calls if it failed.
 *
 * `set(color, ledIndex, fadeMs)` interpolates from the last known colour to
 * the target in software at ~30 fps. Fades are tracked per-key (one per LED,
 * plus 'all' for whole-strip), and a fresh `set` to the same key restarts
 * from wherever the previous fade had got to.
 */
import { findFirstAsync, COLOR_KEYWORD_RGB_TUPLES } from '@ginden/blinkstick-v2';

const FADE_INTERVAL_MS = 30;

function parseColor(color) {
  if (color == null) return null;
  if (Array.isArray(color) && color.length >= 3) {
    return [color[0] & 0xff, color[1] & 0xff, color[2] & 0xff];
  }
  if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
    return [color.r & 0xff, color.g & 0xff, color.b & 0xff];
  }
  if (typeof color === 'string') {
    const trimmed = color.trim().toLowerCase();
    if (trimmed.startsWith('#')) {
      let hex = trimmed.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      if (hex.length !== 6 || /[^0-9a-f]/.test(hex)) return null;
      const n = parseInt(hex, 16);
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    }
    if (Object.hasOwn(COLOR_KEYWORD_RGB_TUPLES, trimmed)) {
      return [...COLOR_KEYWORD_RGB_TUPLES[trimmed]];
    }
  }
  return null;
}

export class Lights {
  constructor(broadcast = null) {
    this.blinkstick = null;
    this.connecting = null;
    this.fades = new Map();        // key → { from, to, start, end, current }
    this.lastColors = new Map();   // key → last colour we wrote
    this.timer = null;
    this.broadcast = broadcast;
  }

  ensure() {
    if (this.blinkstick || this.connecting) return this.connecting;
    this.connecting = findFirstAsync()
      .then((bs) => { this.blinkstick = bs; })
      .catch(() => { /* no device — silently disabled */ })
      .finally(() => { this.connecting = null; });
    return this.connecting;
  }

  // Set the LED strip color. `color` accepts a CSS-style name ('red'),
  // a hex string ('#ff8800' or '#f80'), an [r, g, b] tuple, or {r, g, b}.
  // If `ledIndex` is omitted, all LEDs are set; otherwise just that one.
  // If `fadeMs` is positive, the change is interpolated over that duration.
  set(color, ledIndex, fadeMs = 0) {
    const tuple = parseColor(color);
    if (!tuple) return;

    if (this.broadcast) {
      this.broadcast({
        lights: {
          color: tuple,
          ledIndex: ledIndex == null ? null : (ledIndex | 0),
          fadeMs: fadeMs > 0 ? fadeMs : 0,
        },
      });
    }

    this.ensure();
    if (!this.blinkstick) return;

    const ledCount = this.blinkstick.ledCount || 0;
    const isAll = ledIndex == null;
    const i = isAll ? null : (ledIndex | 0);
    if (!isAll && (i < 0 || i >= ledCount)) return;
    const key = isAll ? 'all' : i;

    // A whole-strip set supersedes any per-LED fades that were still running.
    if (isAll) {
      for (const k of [...this.fades.keys()]) {
        if (k !== 'all') this.fades.delete(k);
      }
    }

    if (!(fadeMs > 0)) {
      this.fades.delete(key);
      this._write(key, tuple);
      return;
    }

    const existing = this.fades.get(key);
    const from = existing
      ? existing.current
      : (this.lastColors.get(key) || [0, 0, 0]);
    const now = Date.now();
    this.fades.set(key, {
      from: [...from],
      to: [...tuple],
      start: now,
      end: now + fadeMs,
      current: [...from],
    });
    this._startTimer();
  }

  _write(key, tuple) {
    this.lastColors.set(key, [...tuple]);
    try {
      if (key === 'all') {
        this.blinkstick.leds().setColor(tuple).catch(() => {});
      } else {
        const [r, g, b] = tuple;
        this.blinkstick.led(key).setColor(r, g, b).catch(() => {});
      }
    } catch (e) {
      // Swallow transient HID errors so a bad write doesn't kill a command.
    }
  }

  _startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick(), FADE_INTERVAL_MS);
  }

  _tick() {
    if (this.fades.size === 0) {
      clearInterval(this.timer);
      this.timer = null;
      return;
    }
    const now = Date.now();
    for (const [key, f] of this.fades) {
      const span = Math.max(1, f.end - f.start);
      const t = Math.min(1, (now - f.start) / span);
      const r = (f.from[0] + (f.to[0] - f.from[0]) * t) | 0;
      const g = (f.from[1] + (f.to[1] - f.from[1]) * t) | 0;
      const b = (f.from[2] + (f.to[2] - f.from[2]) * t) | 0;
      f.current = [r, g, b];
      this._write(key, f.current);
      if (t >= 1) this.fades.delete(key);
    }
  }
}
