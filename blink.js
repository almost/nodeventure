/* Test script for the Blinkstick light strip.
 * Run with `node blink.js`. Exits cleanly after the demo.
 *
 * Walks through:
 *   1. Solid colors across the whole strip (red, green, blue, white)
 *   2. A single LED moving along the strip
 *   3. Random per-LED colors
 *   4. Faded transitions between colors
 *   5. Fade to black and exit
 */
import { Lights } from './src/lights.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lights = new Lights();
await lights.ensure();

if (!lights.blinkstick) {
  console.error('No Blinkstick device found.');
  process.exit(1);
}
const ledCount = lights.blinkstick.ledCount || 8;
console.log(`Found Blinkstick with ${ledCount} LED(s).`);

console.log('1. Solid colors...');
for (const color of ['red', 'green', 'blue', 'white']) {
  console.log(`   ${color}`);
  lights.set(color);
  await delay(800);
}

console.log('2. Sequential per-LED...');
for (let pass = 0; pass < 2; pass++) {
  for (let i = 0; i < ledCount; i++) {
    lights.set('black');
    lights.set('cyan', i);
    await delay(120);
  }
}

console.log('3. Random per-LED colors...');
const randByte = () => Math.floor(Math.random() * 256);
for (let pass = 0; pass < 20; pass++) {
  for (let i = 0; i < ledCount; i++) {
    lights.set([randByte(), randByte(), randByte()], i);
  }
  await delay(100);
}

console.log('4. Fades...');
lights.set('black');
await delay(200);
for (const color of ['red', 'green', 'blue', 'magenta', 'yellow']) {
  console.log(`   fade to ${color}`);
  lights.set(color, null, 600);
  await delay(800);
}

console.log('5. Fade to black and exit.');
lights.set('black', null, 800);
await delay(1000);

process.exit(0);
