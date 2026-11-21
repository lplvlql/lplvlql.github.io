// Regression: knobs, footswitches and LEDs are hollow dotted
// rings — no centre dot at any ring level or cylinder top.
// Run: node tests/pedal-points.test.mjs
import fs from 'node:fs';
import assert from 'node:assert';

const src = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');

const ring = src.match(/function ring\(cx, cy, cz, r, n\) \{([\s\S]*?)\n      \}/);
assert(ring, 'ring() helper exists');
assert(!ring[1].includes('pts.push([cx, cy'), 'ring() must not add a centre dot');

for (const centre of ['pts.push([kx, ky, hd', 'pts.push([fx, fy, hd', 'pts.push([fx, fy - 17, hd']) {
  assert(!src.includes(centre), `no cylinder centre dot: ${centre}`);
}

console.log('pedal-points: no centre dots in knobs, footswitches, or LEDs');
