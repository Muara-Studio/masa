// MASA Sound diorama: a floating rock island with wind-swayed grass and a glass-dome venue whose stage glows.
// Pure shape helpers are exported for tests; buildDiorama takes THREE so node can import this file.

export const ISLAND = { rx: 1.12, rz: 0.94, top: 0.1, depth: 1.45 };
export const DOME = { x: 0.14, z: -0.16, r: 0.4 };
export const STONES = [[0.1, 0.34], [0.03, 0.45], [0.07, 0.56], [0.0, 0.67], [0.04, 0.78]];
export const TREE = [-0.6, 0.02];
export const LAMPS = [[0.2, 0.5], [-0.09, 0.62]];
// grass stays out of the dome, the path, the tree trunk and the lamp posts
export const KEEP = [[DOME.x, DOME.z, DOME.r + 0.025], ...STONES.map(([x, z]) => [x, z, 0.04]), [...TREE, 0.05], ...LAMPS.map(([x, z]) => [x, z, 0.02])];

const hash3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => fade(Math.min(1, Math.max(0, (x - a) / (b - a))));

// value noise in [-1, 1]
export function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
  const c = (i, j, k) => hash3(X + i, Y + j, Z + k);
  return mix(
    mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v),
    mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
}
export function fbm(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
export function mulberry(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// outline wobble as a function of the azimuth only, so the top and the underside share one rim
const edgeAt = (a) => 1 + 0.07 * noise3(Math.cos(a) * 1.7 + 5, 0.5, Math.sin(a) * 1.7 + 5) + 0.025 * noise3(Math.cos(a) * 5, 2, Math.sin(a) * 5);

// normalised radius of (x, z) on the top: 0 at the centre, 1 at the rim
export const rimR = (x, z) => Math.hypot(x / ISLAND.rx, z / ISLAND.rz) / edgeAt(Math.atan2(z / ISLAND.rz, x / ISLAND.rx));

// height of the grassy top: gentle hills, a level pad under the dome, a rounded lip down to y = 0 at the rim
export function topY(x, z) {
  const rim = smooth(0.8, 1, rimR(x, z));
  const pad = smooth(DOME.r + 0.02, DOME.r + 0.22, Math.hypot(x - DOME.x, z - DOME.z));
  const hill = 0.05 * fbm(x * 1.4 + 3, 0, z * 1.4) * pad * (1 - rim);
  return (ISLAND.top + hill) * Math.sqrt(Math.max(0, 1 - rim * rim));
}

// map a unit-sphere direction to the island: the upper half flattens into the top, the lower half hangs as rock
export function islandPoint(dx, dy, dz) {
  const a = Math.atan2(dz, dx), e = edgeAt(a);
  if (dy >= 0) { const x = dx * ISLAND.rx * e, z = dz * ISLAND.rz * e; return [x, topY(x, z), z]; }
  const h = Math.max(Math.hypot(dx, dz), 1e-6), t = Math.max(0, 1 - h); // t: 0 at the rim, 1 at the tip; rim vertices can round to h > 1
  const k = smooth(0, 0.1, t); // no displacement right at the rim, so the seam closes
  const n = fbm(dx * 1.8 + 11, dy * 1.8, dz * 1.8, 5);
  const strata = 0.035 * Math.sin(dy * 26 + n * 4);
  const ridge = 0.06 * (1 - Math.abs(noise3(dx * 5 + 1, dy * 5 + 3, dz * 5))) + 0.03 * noise3(dx * 14, dy * 14, dz * 14); // creases and grit
  const m = e * (1 + k * ((0.18 + 0.26 * t) * n + strata + ridge)) * Math.pow(h, 0.82) / h;
  const lean = 0.2 * t * t; // the tip leans off-centre, like broken-off rock
  const y = -ISLAND.depth * Math.pow(t, 0.75) * (1 + 0.18 * k * fbm(dx * 3 + 7, dy * 3, dz * 3, 3));
  return [dx * ISLAND.rx * m + lean * 0.7, y, dz * ISLAND.rz * m + lean * 0.35];
}

// n deterministic points on the top, outside the keep-out discs
export function scatter(n, seed, keep = KEEP, maxR = 0.98) {
  const rnd = mulberry(seed), out = new Float32Array(n * 2);
  for (let i = 0, tries = 0; i < n && tries < n * 50; tries++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * maxR * edgeAt(a);
    const x = Math.cos(a) * r * ISLAND.rx, z = Math.sin(a) * r * ISLAND.rz;
    if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    out[i * 2] = x; out[i * 2 + 1] = z; i++;
  }
  return out;
}

const GRIT = /* glsl */`
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 bumpN(vec3 p, vec3 n, vec2 dH) { // screen-space bump from a height's derivatives (Mikkelsen)
  vec3 sx = dFdx(p), sy = dFdy(p), r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  return normalize(abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2));
}
`;

// world-space wind for instanced grass, flowers: the bend grows with height above each instance root
const WIND = /* glsl */`
#ifdef USE_INSTANCING
  vec3 root = instanceMatrix[3].xyz;
  float hh = max(mvPosition.y - root.y, 0.0);
  float gust = sin(dot(root.xz, vec2(5.0, 3.0)) - uTime * 2.1) * 0.5 + 0.5;
  float flutter = sin(uTime * 5.3 + root.x * 37.0 + root.z * 23.0);
  mvPosition.xz += vec2(0.85, 0.5) * uWind * hh * hh * (1.0 + 1.7 * gust + 0.35 * flutter);
#endif
`;

export async function buildDiorama(THREE, { blades = 6000, flowers = 90, detail = 44, motion = 1 } = {}) {
  const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
  const C = (hex) => new THREE.Color(hex);
  const uni = { uTime: { value: 0 }, uWind: { value: motion } };
  const root = new THREE.Group();
  const dummy = new THREE.Object3D();
  const rnd = mulberry(7);

  const windy = (mat, flipFree) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        ${WIND}
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
      // blades keep their up-facing normal on both sides, so the back of a blade is not black
      if (flipFree) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    return mat;
  };

  // rock + top: an icosphere remapped by islandPoint, coloured by height
  {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const moss = C(0x2c4a1d), dirt = C(0x4a3520), soil = C(0x3b2616), sand = C(0x7f6c5a), slate = C(0x544c45), dark = C(0x1d1916), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), up = dy >= 0, [x, y, z] = islandPoint(dx, dy, dz);
      p.setXYZ(i, x, y, z);
      const speck = 0.86 + 0.28 * (noise3(x * 31, y * 31, z * 31) * 0.5 + 0.5);
      if (up) {
        c.copy(moss).lerp(dirt, smooth(-0.1, 0.5, fbm(x * 3, 1, z * 3)) * 0.7).lerp(soil, smooth(0.9, 1, rimR(x, z)));
      } else {
        const f = -y / ISLAND.depth;
        c.copy(sand).lerp(slate, smooth(0.08, 0.6, f)).lerp(dark, smooth(0.45, 1, f));
        c.multiplyScalar(1 + 0.12 * Math.sin(y * 34 + fbm(x * 4, y * 2, z * 4) * 5)); // strata bands
        c.multiplyScalar(0.45 + 0.85 * smooth(-0.3, 0.3, fbm(dx * 1.8 + 11, dy * 1.8, dz * 1.8, 5))); // pits dark, bulges catch the light
        const crack = Math.abs(noise3(dx * 6, dy * 9, dz * 6));
        if (crack < 0.07) c.multiplyScalar(0.5 + crack * 7);
        if (f < 0.07) c.lerp(soil, 1 - smooth(0.035, 0.07, f));
      }
      c.multiplyScalar(speck);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, envMapIntensity: 0.35 });
    rock.onBeforeCompile = (sh) => { // fine grit: a procedural bump plus speckle, so the rock reads as stone up close
      sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = 'varying vec3 vObj;\n' + GRIT + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat grit = vn(vObj * 22.) * .6 + vn(vObj * 57.) * .4;\ndiffuseColor.rgb *= .78 + .44 * grit;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = bumpN(-vViewPosition, normal, vec2(dFdx(grit), dFdy(grit)) * .006);');
    };
    root.add(new THREE.Mesh(g, rock));
  }

  // grass: tapered, curved blades in one instanced draw, plus straight flower stems at the end of the set
  const stemAt = flowers;
  {
    const seg = 4, pos = [], cols = [], nrm = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const v = j / seg, hw = 0.0065 * Math.pow(1 - v, 0.9) + 0.0004;
      pos.push(-hw, v, 0.16 * v * v, hw, v, 0.16 * v * v);
      const k = 0.32 + 0.68 * v; cols.push(k, k, k, k, k, k);
      nrm.push(0, 0.94, 0.34, 0, 0.94, 0.34);
      if (j < seg) { const b = j * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    const mesh = new THREE.InstancedMesh(g, windy(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 }), true), blades + stemAt);
    const pts = scatter(blades + stemAt, 11), up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), qy = new THREE.Quaternion(), ql = new THREE.Quaternion();
    const fresh = C(0x77a03c), deep = C(0x3b6a29), dry = C(0xa79b4f), stem = C(0x355a24), c = new THREE.Color();
    for (let i = 0; i < blades + stemAt; i++) {
      const x = pts[i * 2], z = pts[i * 2 + 1], r = rimR(x, z), rim = smooth(0.78, 1, r), isStem = i >= blades;
      const clump = fbm(x * 4 + 2, 3, z * 4) * 0.5 + 0.5;
      const H = isStem ? 0.075 + rnd() * 0.035 : (0.035 + 0.075 * clump + 0.025 * rnd()) * (1 + 0.7 * rim);
      axis.set(z, 0, -x).normalize();
      qy.setFromAxisAngle(up, rnd() * Math.PI * 2);
      ql.setFromAxisAngle(axis, rim * 0.95 + (rnd() - 0.5) * (isStem ? 0.15 : 0.5));
      dummy.quaternion.multiplyQuaternions(ql, qy);
      dummy.position.set(x, topY(x, z) - 0.004, z);
      dummy.scale.set(0.8 + rnd() * 0.6, H, H);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (isStem) c.copy(stem);
      else c.copy(deep).lerp(fresh, clump).lerp(dry, smooth(0.2, 0.75, fbm(x * 2.2, 9, z * 2.2) * 0.5 + 0.5) * 0.55).multiplyScalar(0.85 + rnd() * 0.3);
      mesh.setColorAt(i, c);
    }
    root.add(mesh);

    // flower heads sit at the stem tips: geometry at y = 1, so the stem height is the instance's y scale and the wind matches
    const sh = new THREE.Shape();
    for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2, rr = 0.45 + 0.55 * Math.abs(Math.cos(a * 2.5)); sh[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    const hg = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).translate(0, 1, 0);
    const heads = new THREE.InstancedMesh(hg, windy(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55, envMapIntensity: 0.4 })), flowers);
    const palette = [0xf4efe6, 0xf4efe6, 0xf2c94c, 0xf2c94c, 0xc2479b, 0xb9a3e3, 0xef8a6a];
    const m = new THREE.Matrix4(), base = new THREE.Vector3(), tip = new THREE.Vector3();
    for (let i = 0; i < flowers; i++) {
      mesh.getMatrixAt(blades + i, m);
      base.setFromMatrixPosition(m);
      tip.set(0, 1, 0.16).applyMatrix4(m); // the stem's curved tip
      dummy.position.set(tip.x, base.y, tip.z);
      dummy.quaternion.setFromAxisAngle(up, rnd() * 6.28); // yaw only, so the head stays on the tip
      const s = 0.011 + rnd() * 0.007;
      dummy.scale.set(s, tip.y - base.y, s);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, C(palette[(rnd() * palette.length) | 0]));
    }
    root.add(heads);
  }

  // stepping stones, boulders: faceted pebbles, one draw
  const pebble = (r, s) => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + 0.22 * noise3(p.getX(i) * 2 + s, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    g.computeVertexNormals();
    return g.scale(r, r, r);
  };
  {
    const rocks = [...STONES.map(([x, z]) => [x, z, 0.05, 0.012, 0.042]), [-0.82, 0.3, 0.05, 0.04, 0.045], [-0.5, 0.22, 0.03, 0.025, 0.03], [0.72, 0.42, 0.045, 0.035, 0.04], [0.55, 0.6, 0.025, 0.02, 0.025]];
    const mesh = new THREE.InstancedMesh(pebble(1, 3), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, envMapIntensity: 0.4 }), rocks.length);
    rocks.forEach(([x, z, sx, sy, sz], i) => {
      dummy.position.set(x, topY(x, z) + sy * 0.3, z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, C(i < STONES.length ? 0xbdb4a6 : 0x8f8478));
    });
    root.add(mesh);
  }

  // a small tree: tapered trunk and faceted foliage blobs
  {
    const [x, z] = TREE, y = topY(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.02, 0.2, 7).translate(0, 0.1, 0), new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 }));
    trunk.position.set(x, y, z); trunk.rotation.z = 0.12;
    const blobs = [[-0.012, 0.22, 0, 0.085], [0.05, 0.19, 0.03, 0.06], [-0.06, 0.17, -0.02, 0.055], [0.0, 0.28, -0.01, 0.055]];
    const leaf = new THREE.InstancedMesh(pebble(1, 9), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, envMapIntensity: 0.3 }), blobs.length);
    blobs.forEach(([bx, by, bz, s], i) => {
      dummy.position.set(x + bx, y + by, z + bz); dummy.rotation.set(rnd(), rnd(), rnd()); dummy.scale.setScalar(s); dummy.updateMatrix();
      leaf.setMatrixAt(i, dummy.matrix); leaf.setColorAt(i, C([0x4d7a2f, 0x5f8f38, 0x3f6a29, 0x6a9a3d][i]));
    });
    root.add(trunk, leaf);
  }

  // the venue: deck, round stage, band shell, speakers, then the glass dome and its ribs
  const venue = new THREE.Group();
  venue.position.set(DOME.x, ISLAND.top, DOME.z);
  root.add(venue);
  const R = DOME.r;
  {
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.985, R, 0.014, 64), new THREE.MeshStandardMaterial({ color: 0x34302c, roughness: 0.55 })); // dark floor, so the glass reads as glass
    deck.position.y = 0.007;
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.032, 48), new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.6 }));
    stage.position.set(0, 0.03, -0.1);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 16, Math.PI, Math.PI, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc6, emissive: 0xff8a3d, emissiveIntensity: 0.32, roughness: 0.5, side: THREE.DoubleSide }));
    shell.position.set(0, 0.014, -0.13);
    const spk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.034, 0.06, 0.028).translate(0, 0.03, 0), new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.5 }), 2);
    [-1, 1].forEach((sd, i) => { dummy.position.set(sd * 0.1, 0.046, -0.03); dummy.rotation.set(0, -sd * 0.4, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); spk.setMatrixAt(i, dummy.matrix); });
    venue.add(deck, stage, shell, spk);
  }
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.02, ior: 1.45, envMapIntensity: 1.6, side: THREE.DoubleSide,
  }));
  glass.position.y = 0.012;
  venue.add(glass);
  {
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.35, envMapIntensity: 1.1 });
    const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(R, 0.0035, 6, 64, Math.PI), brass, 4);
    for (let i = 0; i < 4; i++) { dummy.position.set(0, 0.012, 0); dummy.rotation.set(0, (i / 4) * Math.PI, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); ribs.setMatrixAt(i, dummy.matrix); }
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.0045, 6, 96), brass, 3);
    [0, 0.2, 0.31].forEach((y, i) => {
      dummy.position.set(0, y + 0.012, 0); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.scale.setScalar(Math.sqrt(R * R - y * y) + (y ? 0 : 0.005)); dummy.updateMatrix(); rings.setMatrixAt(i, dummy.matrix);
    });
    venue.add(ribs, rings);
  }

  // warm bulbs: a sagging festoon inside the dome, stage footlights and the lamp tops, one draw
  {
    const bulbs = [];
    for (let s = 0; s < 8; s++) for (let k = 0; k < 4; k++) {
      const a = ((s + (k + 0.5) / 4) / 8) * Math.PI * 2, y = 0.24 - 0.035 * Math.sin(Math.PI * (k + 0.5) / 4), rr = Math.sqrt(R * R - (y + 0.01) ** 2) - 0.03;
      bulbs.push([Math.cos(a) * rr, y, Math.sin(a) * rr, 0.0075]);
    }
    for (let k = 0; k < 5; k++) { const a = Math.PI * (0.18 + 0.16 * k); bulbs.push([Math.cos(a) * 0.125, 0.05, -0.1 + Math.sin(a) * 0.125 * 0.98, 0.005]); }
    LAMPS.forEach(([x, z]) => bulbs.push([x - DOME.x, topY(x, z) - ISLAND.top + 0.13, z - DOME.z, 0.011]));
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: C(0xffc27a).multiplyScalar(2.4) }), bulbs.length);
    bulbs.forEach(([x, y, z, s], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    venue.add(mesh);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0035, 0.005, 0.13, 6).translate(0, 0.065, 0), new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.6, roughness: 0.4 }), LAMPS.length);
    LAMPS.forEach(([x, z], i) => { dummy.position.set(x, topY(x, z), z); dummy.scale.setScalar(1); dummy.updateMatrix(); posts.setMatrixAt(i, dummy.matrix); });
    root.add(posts);
  }

  // stage light, glow halo, two sweeping beams
  const lamp = new THREE.PointLight(0xffa24d, 1.2, 1.6, 2);
  lamp.position.set(0, 0.2, -0.05);
  venue.add(lamp);
  const lampL = new THREE.PointLight(0xffb070, 0.12, 0.6, 2);
  lampL.position.set(LAMPS[0][0] - DOME.x, 0.16, LAMPS[0][1] - DOME.z);
  venue.add(lampL);
  const radial = (() => {
    const n = 64, d = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2); const a = Math.pow(Math.max(0, 1 - r), 2.2); d.set([255, 255, 255, a * 255], (y * n + x) * 4); }
    const t = new THREE.DataTexture(d, n, n); t.needsUpdate = true; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial, color: 0xff9a4a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  glow.position.set(0, 0.1, -0.1); glow.scale.setScalar(0.34);
  venue.add(glow);

  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C(0xffb36b) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vY; varying float vF; void main(){ vY = -position.y / 0.26; vec4 mv = modelViewMatrix * vec4(position,1.); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vY; varying float vF; void main(){ float a = (1. - vY) * pow(vF, 1.6) * .4; gl_FragColor = vec4(uColor, a); }`,
  });
  const beams = [];
  {
    const cone = new THREE.ConeGeometry(0.075, 0.26, 28, 1, true).translate(0, -0.13, 0); // apex at the origin, so it swings about the light
    [[-0.06, 0xffb36b], [0.06, 0xd86ab5]].forEach(([x, col]) => {
      const m = beamMat.clone(); m.uniforms.uColor.value = C(col);
      const b = new THREE.Mesh(cone, m); b.position.set(x, 0.3, -0.12);
      venue.add(b); beams.push(b);
    });
  }

  // dust motes drifting inside the dome, plus a few fireflies around the island, one draw
  const dust = (() => {
    const n = 220, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const out = i > 170, a = rnd() * Math.PI * 2;
      const r = out ? 0.7 + rnd() * 0.6 : Math.sqrt(rnd()) * (R - 0.06), y = out ? -0.5 + rnd() * 0.9 : 0.03 + rnd() * Math.sqrt(Math.max(0, R * R - r * r)) * 0.85;
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
      seed.set([rnd(), rnd(), rnd(), out ? 1 : 0], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: uni.uTime, uPx: { value: 300 }, uDrift: { value: motion } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime, uPx, uDrift; attribute vec4 seed; varying float vA; varying float vOut;
        void main(){
          vec3 p = position; float t = uTime * uDrift;
          float a = t * (0.05 + seed.x * 0.12) * (seed.w > .5 ? .4 : 1.);
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          p.y += sin(t * (0.4 + seed.y * 0.5) + seed.z * 6.283) * (seed.w > .5 ? .06 : .025);
          vA = mix(0.6, 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (1.2 + seed.z * 2.6) + seed.y * 6.283), 3.0), uDrift); // no twinkle under reduced motion
          vOut = seed.w;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uPx * (0.5 + seed.x * 0.7) * (seed.w > .5 ? 1.8 : 1.) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; varying float vOut; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(mix(vec3(1., .82, .55), vec3(1., .9, .6), vOut), a * a * vA * (vOut > .5 ? .7 : .9)); }`,
    });
    const pts = new THREE.Points(g, m);
    pts.position.set(0, 0.012, 0);
    venue.add(pts);
    return m;
  })();

  return {
    root,
    resize(px) { dust.uniforms.uPx.value = px; },
    update(t) {
      uni.uTime.value = t;
      const k = uni.uWind.value; // 0 under reduced motion
      beams[0].rotation.z = 0.32 + Math.sin(t * 0.7) * 0.22 * k; beams[0].rotation.x = Math.sin(t * 0.5) * 0.12 * k;
      beams[1].rotation.z = -0.32 + Math.sin(t * 0.6 + 2) * 0.22 * k; beams[1].rotation.x = Math.sin(t * 0.45 + 1) * 0.12 * k;
      const beat = 0.5 + 0.5 * Math.sin(t * 4.2) * k;
      glow.material.opacity = 0.32 + 0.08 * beat;
      lamp.intensity = 1.1 + 0.15 * beat;
    },
  };
}
