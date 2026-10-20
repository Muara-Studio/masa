// Stone wordmark maths (F): our own M, A, S outlines and a value-noise rock displacement. Pure: no DOM, no three.

// Glyphs sit in a unit em (height 1, origin bottom-left). `outer` and `holes` are rings of [x, y].
export function glyph(ch) {
  if (ch === 'M') return { w: 1.04, holes: [], outer: [[0, 0], [.24, 0], [.24, .56], [.52, .24], [.8, .56], [.8, 0], [1.04, 0], [1.04, 1], [.82, 1], [.52, .6], [.22, 1], [0, 1]] };
  if (ch === 'A') return { w: .96, holes: [ellipse(.48, .47, .1, .115, 16)], outer: [[0, 0], [.25, 0], [.32, .2], [.64, .2], [.71, 0], [.96, 0], [.6, 1], [.36, 1]] };
  if (ch === 'S') return { w: .77, holes: [], outer: stroke(sPath(.385, .27, .1925), .23) };
  throw new Error(`no stone glyph for ${ch}`);
}

function ellipse(cx, cy, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos(i / n * 2 * Math.PI), cy + ry * Math.sin(i / n * 2 * Math.PI)]);
}

// the S centreline: upper bowl counter-clockwise from its terminal, lower bowl clockwise, meeting at mid-height
function sPath(cx, rx, ry, n = 28) {
  const arc = (cy, a0, a1) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (a1 - a0) * i / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
  const r = Math.PI / 180;
  return arc(.5 + ry, 25 * r, 270 * r).concat(arc(.5 - ry, 90 * r, -155 * r).slice(1));
}

// thicken a polyline into a closed ring with round ends: left side out, right side back
function stroke(p, w) {
  const L = [], R = [];
  p.forEach(([x, y], i) => {
    const a = p[Math.max(i - 1, 0)], b = p[Math.min(i + 1, p.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], k = w / 2 / Math.hypot(dx, dy);
    L.push([x - dy * k, y + dx * k]);
    R.push([x + dy * k, y - dx * k]);
  });
  // half-turn clockwise around c, starting just after `from`
  const cap = (c, from, n = 8) => Array.from({ length: n - 1 }, (_, i) => {
    const a = Math.atan2(from[1] - c[1], from[0] - c[0]) - (i + 1) * Math.PI / n;
    return [c[0] + w / 2 * Math.cos(a), c[1] + w / 2 * Math.sin(a)];
  });
  const r0 = R[0];
  return [...L, ...cap(p.at(-1), L.at(-1)), ...R.reverse(), ...cap(p[0], r0)];
}

function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const ease = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

// smooth value noise in [0, 1)
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = ease(x - xi), v = ease(y - yi), w = ease(z - zi);
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return mix(
    mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v),
    mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

function fbm(x, y, z) {
  let s = 0, a = .5;
  for (let o = 0; o < 4; o++, a /= 2, x *= 2.03, y *= 2.03, z *= 2.03) s += a * noise3(x, y, z);
  return s / .9375;
}

// Dome the front and back faces toward each stroke's spine, so the letters read as rounded stones rather than slabs.
export function inflate(pos, rings, zc, amt, reach) {
  const out = Float32Array.from(pos), segs = [];
  for (const r of rings) r.forEach(([ax, ay], j) => { const [bx, by] = r[(j + 1) % r.length]; segs.push(ax, ay, bx - ax, by - ay); });
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1];
    let d2 = Infinity;
    for (let j = 0; j < segs.length; j += 4) {
      const px = x - segs[j], py = y - segs[j + 1], ex = segs[j + 2], ey = segs[j + 3];
      const t = Math.max(0, Math.min(1, (px * ex + py * ey) / (ex * ex + ey * ey))), dx = px - ex * t, dy = py - ey * t;
      d2 = Math.min(d2, dx * dx + dy * dy);
    }
    const s = Math.min(1, Math.sqrt(d2) / reach);
    out[i + 2] += Math.sign(pos[i + 2] - zc) * amt * s * (2 - s);
  }
  return out;
}

// Split ring edges longer than `step`, so extrusion walls start dense and tessellation needs fewer passes.
export function resample(ring, step) {
  return ring.flatMap(([ax, ay], j) => {
    const [bx, by] = ring[(j + 1) % ring.length], n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    return Array.from({ length: n }, (_, i) => [ax + (bx - ax) * i / n, ay + (by - ay) * i / n]);
  });
}

// Weld a non-indexed position array by quantised position; numeric keys, because string-keyed merging was the slowest step.
export function weld(pos) {
  const ids = new Map(), out = [], index = new Uint32Array(pos.length / 3);
  for (let i = 0; i < index.length; i++) {
    const x = Math.round(pos[i * 3] * 1e4) + 32768, y = Math.round(pos[i * 3 + 1] * 1e4) + 32768, z = Math.round(pos[i * 3 + 2] * 1e4) + 32768;
    const key = x + y * 65536 + z * 4294967296;
    let j = ids.get(key);
    if (j === undefined) { j = out.length / 3; ids.set(key, j); out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    index[i] = j;
  }
  return { pos: new Float32Array(out), index };
}

// Push each vertex along its normal by lumps plus ridged chips. Returns new positions and a 0..1 cavity term (0 = deepest pit).
export function displace(pos, nrm, seed = 0, amp = .08, freq = 1) {
  const out = new Float32Array(pos.length), cav = new Float32Array(pos.length / 3);
  for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
    const x = (pos[i] + seed * 7.31) * freq, y = (pos[i + 1] + seed * 1.93) * freq, z = (pos[i + 2] + seed * 3.7) * freq;
    const lump = fbm(x * 2.6, y * 2.6, z * 2.6) * 2 - 1;
    const chip = 1 - Math.abs(noise3(x * 6, y * 6, z * 6) * 2 - 1);
    const d = Math.max(-1, Math.min(1, lump * 1.2 + (chip - .6) * .8));
    out[i] = pos[i] + nrm[i] * d * amp;
    out[i + 1] = pos[i + 1] + nrm[i + 1] * d * amp;
    out[i + 2] = pos[i + 2] + nrm[i + 2] * d * amp;
    cav[j] = d * .5 + .5;
  }
  return { pos: out, cav };
}

// Linear-space granite greys: pits darker, slow mottling between patches.
export function rockColours(pos, cav, seed = 0) {
  const col = new Float32Array(pos.length);
  for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
    const m = noise3(pos[i] * 3 + seed * 5, pos[i + 1] * 3, pos[i + 2] * 3);
    const v = (.07 + .26 * ease(Math.min(1, cav[j] * 1.25))) * (.8 + .4 * m);
    col[i] = v; col[i + 1] = v * .99; col[i + 2] = v * .97;
  }
  return col;
}
