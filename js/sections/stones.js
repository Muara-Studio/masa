// Footer stones (F): a rough granite M A S A in a black panel. Press & hold lifts the letters; release drops them with a thud.
import { stage, hasGL, THREE } from '../lib/stage.js';
import { sfx } from '../lib/sfx.js';
import { glyph, resample, weld, inflate, displace, rockColours } from '../lib/stones.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';

// letter, height, centre x, resting lean: our own arrangement across a panel 10 units wide
const WORD = [['M', 1.45, -3.85, -.05], ['A', 1.75, -1.35, .035], ['S', 1.56, 1.45, -.06], ['A', 1.3, 3.95, .07]];
const FILL = .9; // seconds of holding before the stones lift
const PEBBLES = 40;
const DEPTH = .16;
const BEVEL = { bevelThickness: .1, bevelSize: .065, bevelOffset: -.065, bevelSegments: 5, curveSegments: 1 };

const GRAIN = /* glsl */`
uniform float uGrain;
varying vec3 vRock;
float rkHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rkNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(rkHash(i), rkHash(i + vec3(1, 0, 0)), f.x), mix(rkHash(i + vec3(0, 1, 0)), rkHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(rkHash(i + vec3(0, 0, 1)), rkHash(i + vec3(1, 0, 1)), f.x), mix(rkHash(i + vec3(0, 1, 1)), rkHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// bump from a height value via screen-space derivatives, so the grain needs no texture or UVs
vec3 rkBump(vec3 p, vec3 n, float h) {
  vec3 dx = dFdx(p), dy = dFdy(p), r1 = cross(dy, n), r2 = cross(n, dx);
  float det = dot(dx, r1);
  return normalize(abs(det) * n - sign(det) * (dFdx(h) * r1 + dFdy(h) * r2));
}`;

function rockMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93 });
  mat.userData.grain = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrain = mat.userData.grain;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRock;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GRAIN)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 rp = vRock * uGrain;
        float rh = rkNoise(rp * 12.) * .5 + rkNoise(rp * 31.) * .3 + rkNoise(rp * 80.) * .2;
        float sp = rkNoise(mat3(.8, .36, -.48, -.6, .48, -.64, 0., .8, .6) * rp * 120.); // rotated so the specks do not line up on the noise grid
        diffuseColor.rgb *= (.7 + .5 * rh) * (1. + smoothstep(.72, .84, sp) * .35 - smoothstep(.33, .2, sp) * .5);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = rkBump(-vViewPosition, normal, rh * .016);');
  };
  return mat;
}

// extrude our outline with a pillowy bevel, densify, then push the surface into rock
function letterGeometry(ch, seed) {
  const g = glyph(ch), v2 = (r) => resample(r, .06).map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(v2(g.outer));
  shape.holes = g.holes.map((h) => new THREE.Path(v2(h)));
  const dense = new TessellateModifier(.06, 14).modify(new THREE.ExtrudeGeometry(shape, { depth: DEPTH, ...BEVEL }));
  const { pos: welded, index } = weld(dense.attributes.position.array); // caps and sides share one smooth surface
  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(inflate(welded, [g.outer, ...g.holes], DEPTH / 2, .06, .115), 3));
  geo.translate(-g.w / 2, -.5, -DEPTH / 2);
  geo.computeVertexNormals();
  const { pos, cav } = displace(geo.attributes.position.array, geo.attributes.normal.array, seed, .045);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(rockColours(pos, cav, seed), 3));
  geo.computeVertexNormals();
  return { geo, w: g.w };
}

function pebbleGeometry() {
  const { pos: welded, index } = weld(new THREE.IcosahedronGeometry(1, 1).attributes.position.array);
  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(welded, 3));
  geo.computeVertexNormals();
  const { pos, cav } = displace(geo.attributes.position.array, geo.attributes.normal.array, 9, .35, 1.4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(rockColours(pos, cav, 9), 3));
  return geo;
}

export default function init(el, ctx) {
  if (!hasGL()) return; // css/f.css sets MASA in Marcellus instead
  const { reduced, q } = ctx;
  const touch = matchMedia('(hover: none)').matches;
  el.innerHTML = `<canvas class="gl" aria-hidden="true"></canvas>
    <div class="st-cursor" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22"/><circle class="st-fill" cx="24" cy="24" r="22" pathLength="1" stroke-dasharray="1"/></svg><i></i><span id="stones-hint">PRESS &amp; HOLD</span></div>`;
  const s = stage(el.querySelector('canvas'), { fov: 18, dpr: matchMedia('(max-width: 767px)').matches ? 1.5 : 1.75, alpha: false });
  const cur = el.querySelector('.st-cursor');
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Lift the stones');
  el.setAttribute('aria-describedby', 'stones-hint');
  el.classList.toggle('is-touch', touch);

  const { scene, camera } = s;
  const key = new THREE.DirectionalLight(0xfff6ec, 3.6);
  const rim = new THREE.DirectionalLight(0xe4eaff, 2);
  key.position.set(-6, 7, 7);
  rim.position.set(2, 4, -8);
  scene.add(new THREE.HemisphereLight(0xa3a3a3, 0x0b0a09, .35), key, rim);

  const word = new THREE.Group();
  const rock = rockMaterial();
  const letters = [];
  let k = 1, halfH = 1.5, liftH = .6;
  scene.add(word);

  const place = (L) => {
    const sc = L.h * k;
    L.mesh.scale.setScalar(sc);
    L.mesh.position.x = L.x;
    L.base = -halfH + sc * (.5 - .14); // the panel edge crops the bottom 14% of each letter
  };
  // keep the word 10 units wide at any aspect; narrow panels get slightly bigger letters
  s.resize = ({ w, h }) => {
    const aspect = w / h;
    k = 1 + Math.max(0, 2.6 - aspect) * .25;
    halfH = 5 / aspect;
    liftH = .72 * k;
    camera.position.set(0, 0, 5 / (Math.tan(camera.fov * Math.PI / 360) * aspect));
    rock.userData.grain.value = Math.min(1, Math.max(.4, w / 1400)); // coarser grain on small panels, so it does not shimmer
    letters.forEach(place);
  };
  s.resize(s);

  // pebbles: one instanced set; they fade to black, which on this panel reads as vanishing
  const pebbles = new THREE.InstancedMesh(pebbleGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), PEBBLES);
  const P = Array.from({ length: PEBBLES }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: 0, spin: 0 }));
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), s3 = new THREE.Vector3(), grey = new THREE.Color();
  P.forEach((_, i) => { pebbles.setMatrixAt(i, m4.makeScale(0, 0, 0)); pebbles.setColorAt(i, grey.setScalar(1)); });
  pebbles.frustumCulled = false;
  scene.add(pebbles);
  let next = 0, drip = 0;
  const spawn = () => {
    const L = letters[Math.random() * letters.length | 0], b = P[next++ % PEBBLES], sc = L.h * k;
    b.p.set(L.x + (Math.random() - .5) * L.w * sc * .7, L.base + L.y - sc * (.5 - Math.random() * .3), sc * .2);
    b.v.set((Math.random() - .5) * 1.2, Math.random() * .8, .3 + Math.random() * .6);
    b.life = 1.4 + Math.random() * .6;
    b.size = (.035 + Math.random() * .055) * k;
    b.spin = 2 + Math.random() * 5;
  };
  const stepPebbles = (dt) => {
    let moved = false;
    P.forEach((b, i) => {
      if (b.life <= 0) return;
      b.life -= dt;
      b.v.y -= 7 * dt;
      b.p.addScaledVector(b.v, dt);
      const f = Math.max(0, Math.min(1, b.life / .5)), a = b.life * b.spin;
      m4.compose(b.p, q4.setFromEuler(e3.set(a, a * .7, i)), s3.set(b.size, b.size * .75, b.size * .9).multiplyScalar(Math.sqrt(f)));
      pebbles.setMatrixAt(i, m4);
      pebbles.setColorAt(i, grey.setScalar(f));
      moved = true;
    });
    if (moved) pebbles.instanceMatrix.needsUpdate = pebbles.instanceColor.needsUpdate = true;
  };

  let pressed = false, forced = false, lifted = false, hold = 0, liftT = 0, thudDone = true;
  const lift = () => { lifted = true; liftT = 0; thudDone = false; sfx.whoosh(); };
  const release = () => { if (!forced) pressed = lifted = false; };

  // build one letter per idle slot so the hero's intro never stalls on our tessellation
  // shortcut: each build is a ~30-60 ms task on the main thread; move it to a worker if the hero shows a hitch on slow laptops
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 60));
  const built = {};
  WORD.forEach(([ch, h, x, lean], i) => idle(() => {
    try {
      const again = !!built[ch]; // the A outline is symmetric, so the second A shows the first one's back: another stone for free
      const { geo, w } = built[ch] ??= letterGeometry(ch, i + 1);
      const L = { i, h, x, lean, w, yaw: again ? Math.PI : 0, mesh: new THREE.Mesh(geo, rock), base: 0, y: 0, v: 0, rx: 0, ry: 0, rz: 0, rate: .7 + i * .17 };
      place(L);
      word.add(L.mesh);
      letters.push(L);
      if (letters.length === WORD.length && q.has('lift')) { forced = pressed = true; hold = 1; lift(); } // dev: ?lift holds it up
    } catch (err) { console.error('[stones]', err); el.classList.add('is-broken'); }
  }, { timeout: 2000 }));

  let px = 0, py = 0, cx = 0, cy = 0, over = false, snap = true, keyFocus = false;
  s.frame = (t, dt) => {
    const r = el.getBoundingClientRect();
    const centred = touch || forced || (!over && keyFocus);
    el.classList.toggle('is-centre', centred);
    const tx = centred ? r.width / 2 : px - r.left, ty = centred ? r.height * (touch ? .36 : .5) : py - r.top;
    const ease = snap ? 1 : 1 - Math.exp(-dt * 10);
    snap = false;
    cx += (tx - cx) * ease;
    cy += (ty - cy) * ease;
    if (pressed && !lifted) {
      hold = Math.min(1, hold + dt / FILL);
      if (hold === 1 && letters.length === WORD.length) lift();
    } else if (!pressed) hold = Math.max(0, hold - dt * 2.5);
    cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    cur.style.setProperty('--h', hold.toFixed(3));

    if (!reduced) { // idle breathing tilt that leans toward the pointer
      const nx = over ? (px - r.left) / r.width - .5 : 0, ny = over ? (py - r.top) / r.height - .5 : 0;
      const e = 1 - Math.exp(-dt * 2);
      word.rotation.y += (nx * .22 + Math.sin(t * .37) * .03 - word.rotation.y) * e;
      word.rotation.x += (ny * .12 + Math.sin(t * .29 + 1) * .02 - word.rotation.x) * e;
    }

    liftT += dt;
    for (const L of letters) {
      const up = lifted && liftT > L.i * .08, a = t * L.rate + L.i * 1.7;
      if (up) { // a soft spring up to a hover that bobs at each letter's own rate
        L.v += ((liftH + (reduced ? 0 : Math.sin(a) * .07 * k) - L.y) * 26 - L.v * (reduced ? 10 : 5.5)) * dt;
        L.y += L.v * dt;
      } else if (L.y > 0 || L.v > 0) { // gravity back down, one damped bounce
        L.v -= 16 * dt;
        L.y += L.v * dt;
        if (L.y <= 0) {
          L.y = 0;
          if (!thudDone) { thudDone = true; sfx.click(); }
          L.v = !reduced && L.v < -1 ? -L.v * .3 : 0;
        }
      }
      const wob = up && !reduced, e = 1 - Math.exp(-dt * (up ? 1.5 : 6));
      L.rx += ((wob ? Math.sin(a * .8) * .12 : 0) - L.rx) * e;
      L.ry += ((wob ? Math.sin(a * .6 + 2) * .18 : 0) - L.ry) * e;
      L.rz += ((wob ? Math.sin(a * .7 + 4) * .07 : 0) - L.rz) * e;
      L.mesh.position.y = L.base + L.y;
      L.mesh.rotation.set(L.rx, L.yaw + L.ry, L.lean + L.rz);
    }
    if (lifted && !reduced && (drip -= dt) <= 0) { spawn(); drip = liftT < .8 ? .04 : .12 + Math.random() * .14; }
    stepPebbles(dt);
  };

  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    over = snap = true;
    px = e.clientX; py = e.clientY;
    el.classList.add('is-over');
  });
  el.addEventListener('pointerleave', () => { over = false; el.classList.remove('is-over'); });
  el.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; });
  el.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    keyFocus = false;
    el.setPointerCapture(e.pointerId);
    pressed = true;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, release);
  const holdKey = (e) => e.key === ' ' || e.key === 'Enter';
  el.addEventListener('keydown', (e) => {
    if (!holdKey(e)) return;
    e.preventDefault(); // Space would scroll the page
    keyFocus = true;
    pressed = true;
  });
  el.addEventListener('keyup', (e) => { if (holdKey(e)) release(); });
  el.addEventListener('focus', () => { keyFocus = el.matches(':focus-visible'); });
  el.addEventListener('blur', () => { keyFocus = false; release(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press on touch must not open a menu
}
