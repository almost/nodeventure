import { findFirstAsync } from '@ginden/blinkstick-v2';

// Find the first connected device (throws if none are found)
const blinkstick = await findFirstAsync();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const randomByte = () => Math.floor(Math.random() * 256);
const randomColor = () => [randomByte(), randomByte(), randomByte()];

while (true) {
  for (let i = 0; i < blinkstick.ledCount; i++) {
    const [r, g, b] = randomColor();
    blinkstick.led(i).setColor(r, g, b).catch(e => console.log(e));
  }

  await delay(100);
}
// while(true) {
// for (let i = 0; i < blinkstick.ledCount; i++) {
//   console.log(i);
//   await blinkstick.led(i).setColor('red');
// }
// }
// await blinkstick.pulse('red');
// await blinkstick.pulse('blue');
// await blinkstick.pulse('purple');
// await blinkstick.pulse('white');
