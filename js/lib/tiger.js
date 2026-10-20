// Papercraft tiger: flat-shaded lofts from deformed rings, stripes from a band function, and a walk cycle that is a pure function of distance.
// No imports: the stage passes THREE in, so node can test gait() and ik().
const TAU = Math.PI * 2;

// gait, in tiger units (ground at y 0, body about 4 long)
export const DUTY = 0.6;                     // share of a cycle a paw stays planted
export const REACH = 0.4;                    // paw travel either side of its hip
export const STRIDE = (2 * REACH) / DUTY;    // body travel per cycle, so planted paws never slide
const OFF = [0.25, 0.75, 0, 0.5];            // lateral-sequence walk: near fore, far fore, near hind, far hind

// distance walked -> pose: per leg [paw x relative to its hip, lift 0..1], plus body bob, head nod, tail phase
export function gait(d, out = { bob: 0, nod: 0, sway: 0, legs: OFF.map(() => [0, 0]) }) {
  const c = d / STRIDE;
  out.bob = 0.025 * Math.cos(2 * TAU * c);
  out.nod = 0.035 * Math.sin(2 * TAU * c + 1);
  out.sway = TAU * (c - Math.floor(c));
  OFF.forEach((o, i) => {
    const f = (((c + o) % 1) + 1) % 1, leg = out.legs[i];
    if (f < DUTY) { leg[0] = REACH * (1 - (2 * f) / DUTY); leg[1] = 0; return; }
    const u = (f - DUTY) / (1 - DUTY);
    leg[0] = -REACH * Math.cos(Math.PI * u);
    leg[1] = Math.sin(Math.PI * u);
  });
  return out;
}

// two-bone IK in the leg plane; angles measured from straight down, bend -1 puts the joint behind the hip-paw line
export function ik(a, b, x, y, bend, out = [0, 0]) {
  const d = Math.min(Math.max(Math.hypot(x, y), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const hip = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const knee = Math.acos((a * a + b * b - d * d) / (2 * a * b));
  out[0] = Math.atan2(x, -y) + bend * hip;
  out[1] = -bend * (Math.PI - knee);
  return out;
}

// fur: g = (stripe coordinate, up-ness 1 spine .. -1 belly, cream 0..1 or ink below 0, stripe amount)
const FUR = /* glsl */ `
vec3 fur(vec4 g) {
  float u = g.x + sin(g.y * 2.6 + g.x * 1.3) * .2 + sin(g.y * 6.3 - g.x * 2.2) * .06;
  float h = fract(sin(floor(u) * 127.1 + 3.7) * 43758.55);
  float w = (.1 + .12 * h) * g.w * smoothstep(-.9, .1, g.y - .5 * h);
  float aa = fwidth(u) + 1e-4;
  float fz = fwidth(g.z) + 1e-4, cream = smoothstep(.5 - fz, .5 + fz, g.z);
  float s = (1. - smoothstep(w - aa, w + aa, abs(fract(u) - .5))) * (1. - cream);
  vec3 c = mix(tgOrange, tgDeep, smoothstep(.2, 1., g.y) * .6);
  c = mix(c, tgCream, cream);
  return mix(c, tgInk, max(s, 1. - smoothstep(-.5 - fz, -.5 + fz, g.z)));
}`;

export function makeTiger(THREE) {
  const fur = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 });
  fur.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tgOrange: { value: new THREE.Color('#d9762c') }, tgDeep: { value: new THREE.Color('#a9501a') },
      tgCream: { value: new THREE.Color('#f1e4c8') }, tgInk: { value: new THREE.Color('#16110e') },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tig;\nvarying vec4 vTig;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTig = tig;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vTig;\nuniform vec3 tgOrange, tgDeep, tgCream, tgInk;\n${FUR}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = fur(vTig);');
  };
  const flat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...extra });
  const eyeMat = flat('#f0b232', { emissive: '#4a2c00' }), pupilMat = flat('#0d0a08'), noseMat = flat('#a8604f');

  // rings [x, centre y, half height, half width] lofted along x; fn(x, cos, sin) -> fur attribute
  const loft = (rings, seg, fn) => {
    const pos = [], tig = [], idx = [];
    for (const [x, y, ry, rz] of rings) for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      pos.push(x, y + ry * c, rz * s);
      tig.push(...fn(x, c, s));
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg);
      idx.push(a, b, a + seg, b, b + seg, a + seg);
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('tig', new THREE.Float32BufferAttribute(tig, 4));
    g.computeVertexNormals();
    return g;
  };
  const paint = (g, fn) => {
    const p = g.attributes.position, a = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) a.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 4);
    g.setAttribute('tig', new THREE.BufferAttribute(a, 4));
    return g;
  };
  const mesh = (g, m = fur) => new THREE.Mesh(g, m);
  const at = (o, x, y, z = 0) => { o.position.set(x, y, z); return o; };

  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);

  // torso and neck: rump at -1.86, chest deepest under the shoulders, waist tucked up
  body.add(mesh(loft([
    [-1.86, 1.74, 0.04, 0.04], [-1.76, 1.74, 0.27, 0.27], [-1.5, 1.69, 0.47, 0.44], [-1.1, 1.665, 0.485, 0.46],
    [-0.5, 1.635, 0.415, 0.42], [0.15, 1.61, 0.49, 0.47], [0.8, 1.61, 0.63, 0.5], [1.28, 1.67, 0.65, 0.47],
    [1.62, 1.8, 0.52, 0.4], [1.98, 1.98, 0.38, 0.3], [2.12, 2.02, 0.04, 0.04],
  ], 8, (x, c) => [x * 2.4, c, Math.min(1, Math.max(0, 0.5 + 3 * (x > 1.3 ? -0.15 - c : -0.62 - c))), 1]))); // cream belly and chest, a clean edge along the iso-line

  // head: cheek ruff, brow, cream muzzle and chin
  const head = at(new THREE.Group(), 2.15, 1.94);
  head.scale.setScalar(1.15);
  body.add(head);
  head.add(mesh(loft([
    [-0.3, 0.04, 0.04, 0.04], [-0.24, 0.04, 0.36, 0.36], [-0.02, 0.04, 0.44, 0.47], [0.22, 0.06, 0.42, 0.42],
    [0.42, 0.04, 0.35, 0.34], [0.56, -0.06, 0.26, 0.27], [0.68, -0.1, 0.2, 0.22], [0.74, -0.1, 0.05, 0.05],
  ], 8, (x, c, s) => {
    const cream = (x > 0.5 && c < 0.5) || c < -0.6 || (x > -0.12 && x < 0.38 && c < -0.2) || (x > 0.3 && x < 0.48 && c > 0.35 && c < 0.75 && Math.abs(s) > 0.5);
    return [x * 6 + 0.3, c, cream ? 1 : 0, x < 0.5 ? 1 : 0];
  })));
  for (const z of [1, -1]) {
    const ear = at(mesh(paint(new THREE.ConeGeometry(0.16, 0.26, 6), (x, y) => [0, 1, x < 0 || y > 0.06 ? -1 : 0, 0])), -0.04, 0.44, 0.27 * z);
    ear.rotation.set(0.4 * z, 0, 0.25);
    ear.add(at(mesh(paint(new THREE.ConeGeometry(0.1, 0.15, 6), () => [0, 1, 1, 0])), 0.07, -0.04));
    const eye = at(mesh(new THREE.IcosahedronGeometry(0.07, 0), eyeMat), 0.42, 0.17, 0.3 * z);
    eye.scale.set(1, 0.72, 0.55);
    eye.rotation.y = 0.5 * z;
    eye.add(at(mesh(new THREE.IcosahedronGeometry(0.032, 0), pupilMat), 0, 0, 0.045 * z));
    head.add(ear, eye);
  }
  const nose = at(mesh(new THREE.ConeGeometry(0.08, 0.07, 3), noseMat), 0.72, 0.04);
  nose.rotation.set(Math.PI, 0, -0.5);
  head.add(nose);

  // legs: hip pivot -> upper bone -> joint -> lower bone -> paw kept level; [bone a, bone b, upper rings, lower rings, paw curl, shoulder slide]
  const PAW_Y = 0.094, LIFT = [0.26, 0.26, 0.2, 0.2];
  const FRONT = [0.8, 0.92, [[-0.1, 0, 0.02, 0.02], [-0.05, 0, 0.3, 0.17], [0.35, -0.02, 0.26, 0.18], [0.72, 0, 0.2, 0.17], [0.8, 0, 0.03, 0.03]],
    [[-0.08, 0, 0.03, 0.03], [-0.02, 0, 0.2, 0.18], [0.45, 0.02, 0.15, 0.15], [0.85, 0.02, 0.13, 0.14], [0.92, 0.02, 0.03, 0.03]], -0.8, true];
  const HIND = [0.85, 0.78, [[-0.15, 0, 0.03, 0.03], [-0.08, 0, 0.36, 0.2], [0.3, -0.04, 0.32, 0.2], [0.7, -0.02, 0.19, 0.16], [0.88, 0, 0.13, 0.13], [0.92, 0, 0.03, 0.03]],
    [[-0.04, 0, 0.03, 0.03], [0, 0, 0.14, 0.13], [0.4, 0, 0.11, 0.11], [0.72, 0, 0.1, 0.11], [0.78, 0, 0.03, 0.03]], -0.3, false];
  const legs = [[1.2, 1.75, 0.24, FRONT], [1.2, 1.75, -0.24, FRONT], [-1.25, 1.62, 0.26, HIND], [-1.25, 1.62, -0.26, HIND]].map(([x, y, z, [a, b, up, lo, curl, slide]], i) => {
    const bone = (rings, lower) => mesh(loft(rings, 7, (t, c, s) => [t * 3.4 + i * 0.37, 0.2 + 0.6 * Math.abs(s), lower && c < -0.35 ? 1 : 0, lower ? 0.6 : 1]).rotateZ(-Math.PI / 2));
    const hip = at(new THREE.Group(), x, y, z), joint = at(new THREE.Group(), 0, -a), paw = at(new THREE.Group(), 0, -b);
    paw.add(mesh(paint(new THREE.SphereGeometry(0.17, 7, 4).scale(1.35, 0.55, 1.1).translate(0.06, 0, 0), () => [0, 0, 0.5, 0])));
    joint.add(bone(lo, true), paw);
    hip.add(bone(up, false), joint);
    body.add(hip);
    return { hip, joint, paw, a, b, y, curl, slide, reach: (0.97 * (a + b)) ** 2, lift: LIFT[i] };
  });

  // tail: a chain that droops and curls up at the tip, ink-tipped rings
  const TAIL = [Math.PI + 0.95, -0.22, -0.3, -0.35, -0.4], LEN = 0.42;
  const tail = [];
  TAIL.reduce((parent, rest, i) => {
    const r0 = 0.12 - i * 0.012, r1 = r0 - 0.012, last = i === TAIL.length - 1;
    const seg = at(new THREE.Group(), i ? LEN : 0, 0);
    seg.add(mesh(loft([[-0.03, 0, r0, r0], [LEN / 2, 0, (r0 + r1) / 2, (r0 + r1) / 2], [LEN + 0.03, 0, r1, r1], ...(last ? [[LEN + 0.08, 0, 0.03, 0.03]] : [])],
      6, (x) => [(i * LEN + x) * 3.2, 1, last && x > LEN * 0.35 ? -1 : 0, 1])));
    seg.userData.rest = rest;
    parent.add(seg);
    tail.push(seg);
    return seg;
  }, at(new THREE.Group(), -1.78, 1.92));
  body.add(tail[0].parent);

  const g = gait(0), q = [0, 0];
  // d: distance walked (also the root's x); look: head turn toward the camera, radians
  function pose(d, look = 0) {
    gait(d, g);
    root.position.x = d;
    body.position.y = g.bob;
    head.rotation.set(0, -look, -0.1 + g.nod);
    legs.forEach((L, i) => {
      const [x, lift] = g.legs[i];
      // fore legs stay near-straight columns: the shoulder blade slides inside the chest instead of the leg folding
      const ty = PAW_Y - L.y - g.bob, off = L.slide ? Math.min(0.2, Math.max(-0.08, ty + Math.sqrt(L.reach - x * x))) : 0;
      L.hip.position.y = L.y + off;
      ik(L.a, L.b, x, ty - off + lift * L.lift, -1, q);
      L.hip.rotation.z = q[0];
      L.joint.rotation.z = q[1];
      L.paw.rotation.z = -(q[0] + q[1]) + L.curl * lift;
    });
    tail.forEach((seg, i) => {
      seg.rotation.z = seg.userData.rest + 0.05 * Math.sin(2 * g.sway - i * 0.7);
      seg.rotation.y = 0.14 * Math.sin(g.sway - i * 0.8);
    });
  }
  pose(0);
  return { root, pose, length: 6.6, height: 2.6 };
}
