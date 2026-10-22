// Procedural Phalaenopsis sprays. Outlines and layout are pure; builders take THREE as an argument so node tests can import this file.

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const bell = (v, a, b) => Math.pow(Math.sin(Math.PI * Math.pow(v, a)), b);

// half-width of a part's outline at v (0 = base, 1 = tip), as a fraction of its length
export function halfWidth(kind, v) {
  v = clamp01(v);
  if (kind === 'petal') return 0.62 * bell(v, 1.45, 0.6) * (0.3 + 0.7 * sstep(0, 0.42, v)); // broad and round on a narrow claw
  if (kind === 'sepal') return 0.33 * bell(v, 1.1, 0.7);
  if (kind === 'lobe') return 0.46 * bell(v, 0.9, 0.6);
  if (kind === 'lip') return 0.4 * bell(v, 1.3, 0.85) * (0.3 + 0.7 * sstep(0.08, 0.45, v)); // mid-lobe with a narrow isthmus
  if (kind === 'tendril') return 0.07 * (1 - 0.7 * v);
  return 0;
}

// a curved sheet: (u across -1..1, v along 0..1) -> [x, y, z, lateral offset / len]; length runs up +y, face toward +z
function sheet(kind, len, { cup = 0, bend = 0, curl = 0, ruffle = 0 } = {}) {
  return (u, v) => {
    const x = u * halfWidth(kind, v) * len, a = curl * v;
    const cx = curl ? (len / curl) * (1 - Math.cos(a)) : 0, cy = curl ? (len / curl) * Math.sin(a) : v * len;
    const z = (cup * x * x) / len + bend * v * v * len + ruffle * len * Math.sin(v * 11 + u * 3) * Math.abs(u) ** 3;
    return [cx + x * Math.cos(a), cy - x * Math.sin(a), z, x / len];
  };
}

// the column: a short tube with a rounded anther cap
function column(len, r0) {
  return (u, v) => {
    const r = r0 * (1 - 0.2 * v) * Math.sqrt(Math.max(1 - v ** 6, 0)), a = Math.PI * u;
    return [r * Math.cos(a), v * len, r * Math.sin(a), 0];
  };
}

// tilt about x (positive leans the tip toward the viewer), spin about z to `angle` degrees, then move to `at`
function placer({ angle = 90, tilt = 0, at = [0, 0, 0] }) {
  const ra = ((angle - 90) * Math.PI) / 180, ca = Math.cos(ra), sa = Math.sin(ra), ct = Math.cos(tilt), st = Math.sin(tilt);
  return (x, y, z) => {
    const y1 = y * ct - z * st, z1 = y * st + z * ct;
    return [x * ca - y1 * sa + at[0], x * sa + y1 * ca + at[1], z1 + at[2]];
  };
}

function addPart(G, id, fn, nu, nv, place) {
  const base = G.pos.length / 3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * 2 - 1, v = j / nv, [x, y, z, xw] = fn(u, v);
    G.pos.push(...place(x, y, z));
    G.part.push(u, v, id, xw);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, c = a + nu + 1;
    G.index.push(a, a + 1, c + 1, a, c + 1, c);
  }
}

// one open flower facing +z, heart at the origin, petal length ~1. part ids: 0 sepal, 1 petal, 2 side lobe, 3 mid-lobe, 4 tendril, 5 column
export function flowerArrays() {
  const G = { pos: [], part: [], index: [] };
  addPart(G, 0, sheet('sepal', 0.92, { cup: 0.5, bend: -0.14 }), 8, 12, placer({ angle: 90, tilt: -0.08, at: [0, 0.04, -0.05] }));
  for (const s of [-1, 1]) {
    addPart(G, 0, sheet('sepal', 0.9, { cup: 0.45, bend: -0.12, curl: -0.15 * s }), 8, 12, placer({ angle: 90 + s * 132, tilt: -0.04, at: [0, -0.02, -0.07] }));
    addPart(G, 1, sheet('petal', 0.98, { cup: 0.38, bend: -0.16, ruffle: 0.03 }), 12, 16, placer({ angle: 90 + s * 74, tilt: 0.2, at: [0, 0.02, 0] }));
    addPart(G, 2, sheet('lobe', 0.38, { cup: 1.3, bend: 0.15 }), 6, 8, placer({ angle: 90 + s * 48, tilt: 0.85, at: [s * 0.05, -0.1, 0.1] }));
  }
  const lip = sheet('lip', 0.5, { cup: -0.8, bend: 0.5 }), lipAt = placer({ angle: 270, tilt: 0.9, at: [0, -0.1, 0.12] });
  addPart(G, 3, lip, 8, 10, lipAt);
  const tip = lipAt(...lip(0, 1));
  for (const s of [-1, 1]) addPart(G, 4, sheet('tendril', 0.16, { curl: 2.6 * s }), 2, 6, placer({ angle: 270 + s * 28, tilt: 0.9, at: tip }));
  addPart(G, 5, column(0.24, 0.07), 10, 8, placer({ angle: 270, tilt: 1.0, at: [0, 0.11, 0.06] }));
  return G;
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// rachis control points (spray-local, base at the origin, a bare stem rising into an arch toward -x) and where flowers and buds sit on it
export function planSpray({ seed = 1, flowers = 5, buds = 3, reach = 1, rise = 1, stem = 0 } = {}) {
  const r = rng(seed), j = (a) => (r() - 0.5) * a;
  const pts = [[0.3 * stem, -stem], [0, 0], [-0.5, 1.6], [-1.6, 2.8], [-3, 3.1], [-4.2, 2.4], [-4.9, 1.1], [-5.2, -0.4]]
    .map(([x, y], i) => [x * reach + (i > 1 ? j(0.3) : 0), y * rise + (i > 1 ? j(0.3) : 0), i * 0.05]);
  if (!stem) pts.shift();
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  // flowers open from the base upward, so the oldest and largest sit furthest from the tip
  const at = (d) => Math.max(0.02, 1 - d / len);
  const fl = Array.from({ length: flowers }, (_, i) => {
    const k = flowers > 1 ? i / (flowers - 1) : 0;
    return { t: at(1.25 + (flowers - 1 - i) * 1.45 + j(0.15)), s: (1 - 0.24 * k) * (1 + j(0.08)), side: i % 2 ? 1 : -1, rz: j(0.5), rx: j(0.7), ry: j(1.1) };
  });
  const bd = Array.from({ length: buds }, (_, i) => ({ t: at(0.85 - (0.8 * i) / Math.max(buds - 1, 1)), s: 1 - 0.45 * (i / buds) }));
  return { pts, flowers: fl, buds: bd };
}

// sprays for the hero. x, y are view fractions (-1..1) at depth z; g* push a spray out to its gate pose; s is size in view units
export function sprayLayout(mobile) {
  const all = [
    { seed: 7, variant: 0, dir: 1, flowers: 5, stem: 3, x: 0.35, y: -0.3, z: 1, r: 1.25, s: 0.8, gx: 0.2, gy: -1.6, gr: 0.5, par: 0.35 },
    { seed: 3, variant: 1, dir: -1, flowers: 2, stem: 2, reach: 0.45, x: -1.38, y: -0.15, z: 2.6, r: -0.15, s: 0.95, gx: -0.04, gy: -0.1, gr: 0.12, par: 0.5 },
    { seed: 11, variant: 2, dir: 1, flowers: 4, stem: 2, x: 1.2, y: 0.15, z: -0.8, r: 0.6, s: 0.55, gx: 0.05, gy: -0.1, gr: 0.15, par: 0.22 },
  ];
  if (!mobile) return all;
  // phones: three sprays with their own poses, fewer flowers
  const phone = [{ x: 0.95, y: 0.3, s: 1 }, { x: -1.6, y: 0.3, s: 0.75 }, { x: 1.4, y: -0.8, s: 0.65 }];
  return all.slice(0, 3).map((o, i) => ({ ...o, ...phone[i], flowers: Math.min(o.flowers, 4) }));
}

// petal colours per variant: throat side, tip, veins and spots, lip; mix = vein, spot and rim-flush strengths
const VARIANTS = [
  { a: [0.99, 0.94, 0.97], b: [0.86, 0.42, 0.74], c: [0.58, 0.03, 0.44], lip: [0.5, 0.03, 0.2], mix: [0.9, 0.85, 0.6] },
  { a: [0.96, 0.8, 0.9], b: [0.78, 0.2, 0.58], c: [0.42, 0.02, 0.32], lip: [0.45, 0.02, 0.18], mix: [0.6, 0.5, 0.5] },
  { a: [0.8, 0.45, 0.68], b: [0.45, 0.06, 0.35], c: [0.2, 0.01, 0.16], lip: [0.32, 0.01, 0.14], mix: [0.5, 0.4, 0.4] },
];

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y); }`;

const vert = (attr, assign) => /* glsl */ `
${attr}
uniform float uSway, uLen;
varying vec3 vN, vV;
void main() {
  vec4 p = vec4(position, 1.); vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  // the spray bends like a whip: the turn grows with distance from its base
  float k = clamp(length(p.xy) / uLen, 0., 1.), a = uSway * k * k, c = cos(a), s = sin(a);
  mat2 R = mat2(c, s, -s, c); p.xy = R * p.xy; n.xy = R * n.xy;
  vec4 mv = modelViewMatrix * p;
  vN = normalMatrix * n; vV = -mv.xyz;
  ${assign}
  gl_Position = projectionMatrix * mv;
}`;

// soft key from the upper left, wrap diffuse, light through thin tissue, a velvet rim and faint crystalline glints
const SHADE = /* glsl */ `
uniform vec3 uKey;
varying vec3 vN, vV;
vec3 shade(vec3 col, float thin, float gloss, vec2 glint) {
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vV);
  float ndl = dot(N, uKey);
  vec3 lin = pow(col, vec3(2.2));
  vec3 c = lin * (.24 + .92 * max(ndl * .6 + .4, 0.));
  c += lin * lin * 1.3 * max(-ndl, 0.) * thin;
  c += pow(1. - abs(dot(N, V)), 3.) * .35 * (lin * .5 + .2) * thin;
  float sp = pow(max(dot(reflect(-uKey, N), V), 0.), 22.);
  c += sp * gloss * (.16 + .6 * step(.993, hash(floor(glint))));
  return pow(c, vec3(1. / 2.2));
}`;

const PETAL_FRAG = /* glsl */ `
uniform vec3 uA, uB, uC, uLip, uMix;
varying vec4 vP;
${NOISE}
${SHADE}
void main() {
  float u = vP.x, v = vP.y, id = vP.z, x = vP.w;
  float thin = .45 + .55 * smoothstep(.55, 1., max(abs(u), v)), gloss = 1.;
  vec3 col;
  if (id < 1.5) {
    // polar coordinates from the heart: blotches stretch along the veins and crowd mid-petal, the rim flushes deeper
    float r = length(vec2(x, v + .08)), ang = atan(x, v + .08);
    vec2 pq = vec2(ang * 5., r * 3.2);
    float n1 = vnoise(pq * 1.3), n2 = vnoise(pq * vec2(4.5, 3.) + 7.), n3 = vnoise(pq * vec2(11., 5.) + 3.);
    float blot = smoothstep(.5, .66, n2 * .6 + n3 * .55 - .12 * r) * smoothstep(.05, .22, v);
    float vein = smoothstep(.55, 1., sin(ang * 34. + n1 * 4.)) * .5 * smoothstep(.1, .5, v);
    col = mix(uA, uB, clamp(smoothstep(.15, 1., r) * .85 + .25 * n1 - .1, 0., 1.));
    col = mix(col, uC, clamp((blot * uMix.y + vein * uMix.x) * (.55 + .45 * n1), 0., 1.));
    col = mix(col, uC * 1.2, uMix.z * smoothstep(.7, 1., max(abs(u), v * v)) * (.5 + .5 * n1));
    col = mix(col, vec3(.99, .96, .98), .8 * (1. - smoothstep(.02, .15, v)));
    if (id < .5) col = mix(col, (uA + uB) * .5, .25);
  } else if (id < 2.5) {
    col = mix(vec3(.96, .72, .2), uLip, smoothstep(.04, .3, v));
    col = mix(col, uLip * .55, smoothstep(.6, 1., sin(v * 40. + u * 3.)) * smoothstep(.2, .5, v) * .7);
  } else if (id < 3.5) {
    col = mix(uLip * 1.2, uLip * .75, smoothstep(.2, .8, v));
    col = mix(col, vec3(.98, .86, .9), (1. - smoothstep(0., .25, abs(u))) * (1. - smoothstep(0., .35, v)) * .6);
  } else if (id < 4.5) {
    col = mix(uLip, vec3(.95, .82, .88), v);
  } else {
    col = mix(vec3(.97, .93, .95), vec3(.98, .74, .12), smoothstep(.55, .75, v)); thin = 0.; gloss = .4;
  }
  gl_FragColor = vec4(shade(col, thin, gloss, vec2(u * 40., v * 70.) + id * 13.), 1.);
}`;

const STEM_FRAG = /* glsl */ `
varying vec3 vP;
${NOISE}
${SHADE}
void main() {
  vec3 col = vP.z < .5
    ? mix(vec3(.4, .27, .13), vec3(.43, .43, .19), smoothstep(0., .7, vP.x))
    : mix(vec3(.4, .45, .2), vec3(.6, .2, .46), smoothstep(.3, .9, vP.y));
  gl_FragColor = vec4(shade(col, .15, .35, vec2(0.)), 1.);
}`;

export function flowerGeometry(THREE) {
  const G = flowerArrays(), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(G.part, 4));
  g.setIndex(G.index);
  g.computeVertexNormals();
  return g;
}

function merge(THREE, geos, kinds) {
  let n = 0, ni = 0;
  for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), kind = new Float32Array(n), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  geos.forEach((g, k) => {
    const c = g.attributes.position.count, gi = g.index.array;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); kind.fill(kinds[k], o, o + c);
    for (let i = 0; i < gi.length; i++) idx[oi + i] = gi[i] + o;
    o += c; oi += gi.length; g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// one spray: an instanced set of flowers plus one merged mesh for rachis, pedicels and buds (2 draw calls)
export function buildSpray(THREE, spec, flowerGeo, key) {
  const V = THREE.Vector3, plan = planSpray(spec), dir = spec.dir;
  const curve = new THREE.CatmullRomCurve3(plan.pts.map(([x, y, z]) => new V(x * dir, y, z)));
  const len = curve.getLength();
  const v3 = (a) => new THREE.Vector3(...a);
  const pal = VARIANTS[spec.variant];
  const uniforms = { uSway: { value: 0 }, uLen: { value: 6 }, uKey: { value: key } };
  const petalMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uA: { value: v3(pal.a) }, uB: { value: v3(pal.b) }, uC: { value: v3(pal.c) }, uLip: { value: v3(pal.lip) }, uMix: { value: v3(pal.mix) } },
    vertexShader: vert('attribute vec4 aPart; varying vec4 vP;', 'vP = aPart;'),
    fragmentShader: PETAL_FRAG, side: THREE.DoubleSide,
  });
  const stemMat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert('attribute float aKind; varying vec3 vP;', 'vP = vec3(uv, aKind);'), fragmentShader: STEM_FRAG,
  });

  // rachis, tapering toward the tip
  const rachis = new THREE.TubeGeometry(curve, 96, 0.036, 7);
  const rp = rachis.attributes.position, P = new V(), T = new V(), C = new V(), q = new THREE.Quaternion(), e = new THREE.Euler(), m = new THREE.Matrix4();
  for (let i = 0; i <= 96; i++) {
    curve.getPointAt(i / 96, P);
    const k = 1 - 0.6 * (i / 96);
    for (let r = 0; r <= 7; r++) { const vi = i * 8 + r; C.fromBufferAttribute(rp, vi).sub(P).multiplyScalar(k).add(P); rp.setXYZ(vi, C.x, C.y, C.z); }
  }
  const parts = [rachis], kinds = [0];

  const flowers = new THREE.InstancedMesh(flowerGeo, petalMat, plan.flowers.length);
  const down = new V(-Math.sin(spec.r), -Math.cos(spec.r), 0).multiplyScalar(0.8); // world-down in spray space
  plan.flowers.forEach((f, i) => {
    curve.getPointAt(f.t, P); curve.getTangentAt(f.t, T);
    // hang off the rachis, sideways from the tangent and biased downward
    const off = new V(T.y * f.side, -T.x * f.side, 0).add(down).normalize();
    C.copy(P).addScaledVector(off, 0.62 * f.s).add(new V(0, 0, 0.2 * f.s));
    // the dorsal sepal leans toward the rachis, but the lip stays at the bottom (the flowers are resupinate)
    const a0 = Math.atan2(P.y - C.y, P.x - C.x) - Math.PI / 2 + spec.r, lean = Math.atan2(Math.sin(a0), Math.cos(a0));
    e.set(f.rx, f.ry * dir, Math.max(-0.55, Math.min(0.55, lean)) - spec.r + f.rz * 0.6);
    m.compose(C, q.setFromEuler(e), new V(f.s, f.s, f.s).multiplyScalar(0.92));
    flowers.setMatrixAt(i, m);
    const back = C.clone().add(new V(0, 0, -0.08 * f.s));
    const mid = P.clone().lerp(back, 0.5).addScaledVector(off, 0.12);
    parts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(P.clone(), mid, back), 8, 0.016, 5)); kinds.push(0);
  });

  plan.buds.forEach((b) => {
    const t = Math.min(b.t, 1);
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    const s = b.s * 0.17, g = new THREE.SphereGeometry(1, 12, 9), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) { const y = gp.getY(i), w = 0.5 * (1 - 0.45 * Math.max(y, 0)); gp.setXYZ(i, gp.getX(i) * w, y, gp.getZ(i) * w); }
    g.computeVertexNormals();
    const axis = T.clone().add(new V(0, -0.6, 0)).normalize();
    g.scale(s, s, s);
    g.applyQuaternion(q.setFromUnitVectors(new V(0, 1, 0), axis));
    g.translate(P.x + axis.x * s * 0.9, P.y + axis.y * s * 0.9, P.z + axis.z * s * 0.9);
    parts.push(g); kinds.push(1);
  });

  const stems = new THREE.Mesh(merge(THREE, parts, kinds), stemMat);
  const group = new THREE.Group();
  group.add(stems, flowers);
  uniforms.uLen.value = len * 0.75;
  return { group, uniforms, materials: [petalMat, stemMat] };
}
