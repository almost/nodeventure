/* Direct hardware test for the Blinkstick light strip. Runs without the
 * server — useful for verifying that the LEDs and HID permissions work
 * before bringing up the rest of the stack.
 *
 * Run with `node blink.js`. Exits cleanly after the demo.
 *   1. Solid colors across the whole strip (red, green, blue, white)
 *   2. A single cyan LED moving along the strip
 *   3. Random per-LED colors
 *   4. Faded transitions between colors
 *   5. Fade to black and exit
 */
import { findFirstAsync, COLOR_KEYWORD_RGB_TUPLES } from '@ginden/blinkstick-v2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const blinkstick = await findFirstAsync().catch(() => null);
if (!blinkstick) {
  console.error('No Blinkstick device found.');
  process.exit(1);
}
const ledCount = blinkstick.ledCount || 8;
console.log(`Found Blinkstick with ${ledCount} LED(s).`);

function rgbOf(name) {
  const tuple = COLOR_KEYWORD_RGB_TUPLES[name];
  return tuple ? [...tuple] : [0, 0, 0];
}

async function setAll([r, g, b]) {
  await blinkstick.leds().setColor([r, g, b]).catch(() => {});
}

async function setOne(i, [r, g, b]) {
  await blinkstick.led(i).setColor(r, g, b).catch(() => {});
}

// Software fade across the whole strip.
async function fadeAll(toName, durationMs, fromTuple) {
  const to = rgbOf(toName);
  const from = fromTuple || [0, 0, 0];
  const steps = Math.max(1, Math.floor(durationMs / 30));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const tuple = [
      (from[0] + (to[0] - from[0]) * t) | 0,
      (from[1] + (to[1] - from[1]) * t) | 0,
      (from[2] + (to[2] - from[2]) * t) | 0,
    ];
    await setAll(tuple);
    await delay(30);
  }
  return to;
}

console.log('1. Solid colors...');
for (const color of ['red', 'green', 'blue', 'white']) {
  console.log(`   ${color}`);
  await setAll(rgbOf(color));
  await delay(800);
}

console.log('2. Sequential per-LED...');
for (let pass = 0; pass < 2; pass++) {
  for (let i = 0; i < ledCount; i++) {
    await setAll([0, 0, 0]);
    await setOne(i, rgbOf('cyan'));
    await delay(120);
  }
}

console.log('3. Random per-LED colors...');
const randByte = () => Math.floor(Math.random() * 256);
for (let pass = 0; pass < 20; pass++) {
  for (let i = 0; i < ledCount; i++) {
    await setOne(i, [randByte(), randByte(), randByte()]);
  }
  await delay(100);
}

console.log('4. Fades...');
await setAll([0, 0, 0]);
await delay(200);
let last = [0, 0, 0];
for (const color of ['red', 'green', 'blue', 'magenta', 'yellow']) {
  console.log(`   fade to ${color}`);
  last = await fadeAll(color, 600, last);
  await delay(200);
}

console.log('5. Fade to black and exit.');
await fadeAll('black', 800, last);

process.exit(0);
