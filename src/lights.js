/* Server-side lights broadcaster.
 *
 * The server doesn't talk to the Blinkstick directly anymore — on macOS HID
 * access is gated by the GUI session, so a separate daemon (`lights-client.js`)
 * runs in the console user's GUI session and drives the hardware. This class
 * just normalizes color input and fans the change out two ways:
 *
 *   - via `playerBroadcast`, embedded in the existing per-player `write`
 *     stream (so connected browsers can paint the header colour);
 *   - via `ioBroadcast`, a dedicated `lights` socket.io event the daemon
 *     subscribes to without needing to log in as a player.
 */
import { COLOR_KEYWORD_RGB_TUPLES } from '@ginden/blinkstick-v2';

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
  constructor(playerBroadcast = null) {
    this.playerBroadcast = playerBroadcast;
    this.ioBroadcast = null;
  }

  // Set the LED strip color. Color, ledIndex, fadeMs are forwarded to anyone
  // listening (browsers, the hardware daemon). No local hardware access.
  set(color, ledIndex, fadeMs = 0) {
    const tuple = parseColor(color);
    if (!tuple) return;
    const payload = {
      color: tuple,
      ledIndex: ledIndex == null ? null : (ledIndex | 0),
      fadeMs: fadeMs > 0 ? fadeMs : 0,
    };
    if (this.playerBroadcast) this.playerBroadcast({ lights: payload });
    if (this.ioBroadcast) this.ioBroadcast(payload);
  }
}
