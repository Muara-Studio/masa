// Four block toys in matte clay: rounded cubes, quarter-cylinders and balls. Each toy has k: 0 assembled .. 1 blown apart.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const Q = Math.PI / 2;
// [colour, parts]; part = [kind, size, centre (corner for quarters), z rotation]
const TOYS = [
  ['#2f3fb8', [ // a bird
    ['box', [2, 1, 1], [0, 0, 0]], ['quarter', [1, 1], [-1, 0.5, 0], Q], ['ball', [0.5], [0.6, 1, 0]],
    ['quarter', [0.45, 0.6], [1.1, 1, 0], -Q], ['box', [0.22, 0.6, 0.22], [-0.35, -0.8, 0]],
    ['box', [0.22, 0.6, 0.22], [0.35, -0.8, 0]], ['box', [1.7, 0.3, 1], [0, -1.25, 0]],
  ]],
  ['#ef6a2a', [ // a little house
    ['box', [2, 1.4, 1], [0, -0.5, 0]], ['quarter', [1, 0.9], [0, 0.2, 0], Q], ['quarter', [1, 0.9], [0, 0.2, 0], 0],
    ['box', [0.3, 0.55, 0.3], [0.6, 1.15, 0]], ['box', [0.5, 0.8, 0.25], [0, -0.8, 0.5]],
    ['ball', [0.2], [-0.55, -0.15, 0.5]], ['ball', [0.2], [0.55, -0.15, 0.5]],
  ]],
  ['#7fb3ff', [ // a flower in a pot
    ['ball', [0.42], [0, 1.05, 0.15]],
    ...[0, 1, 2, 3].map((i) => ['quarter', [0.75, 0.5], [Math.cos(i * Q + Q / 2) * 0.12, 1.05 + Math.sin(i * Q + Q / 2) * 0.12, 0], i * Q]),
    ['box', [0.24, 1.3, 0.24], [0, -0.1, 0]], ['quarter', [0.6, 0.3], [0.12, -0.25, 0], 0], ['box', [1.3, 0.75, 1], [0, -1.1, 0]],
  ]],
  ['#ef6a2a', [ // an M that stands like a figure
    ['box', [0.6, 2, 1], [-0.95, 0, 0]], ['box', [0.6, 2, 1], [0.95, 0, 0]],
    ['quarter', [0.65, 0.9], [0, 0.25, 0], Q], ['quarter', [0.65, 0.9], [0, 0.25, 0], 0],
    ['ball', [0.3], [0, 1.25, 0]], ['box', [3, 0.3, 1], [0, -1.15, 0]],
  ]],
];

const geo = {
  box: ([w, h, d]) => new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.18),
  ball: ([r]) => new THREE.SphereGeometry(r, 32, 20),
  quarter: ([r, d]) => {
    const s = new THREE.Shape().moveTo(0, 0).lineTo(r - 0.06, 0).absarc(0, 0, r - 0.06, 0, Q, false).lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: d - 0.12, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 18 }).translate(0, 0, -(d - 0.12) / 2);
  },
};

// tiling ridged value noise: the crumpled-clay bump
function clay(n = 128) {
  const px = new Uint8Array(n * n * 4), lat = [4, 8, 16, 32].map((s) => [s, Float32Array.from({ length: s * s }, Math.random)]);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0, amp = 0.5;
    for (const [s, g] of lat) {
      const fx = (x / n) * s, fy = (y / n) * s, i = Math.floor(fx), j = Math.floor(fy), u = smooth(fx - i), w = smooth(fy - j);
      const at = (a, b) => g[(b % s) * s + (a % s)];
      const k = at(i, j) * (1 - u) * (1 - w) + at(i + 1, j) * u * (1 - w) + at(i, j + 1) * (1 - u) * w + at(i + 1, j + 1) * u * w;
      v += amp * (1 - Math.abs(2 * k - 1));
      amp *= 0.5;
    }
    px.fill(Math.min(255, v * 255), (y * n + x) * 4, (y * n + x) * 4 + 4);
  }
  const t = new THREE.DataTexture(px, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.8, 0.8);
  t.needsUpdate = true;
  return t;
}

export function makeToys() {
  const group = new THREE.Group(), bump = clay(), box = new THREE.Box3(), c = new THREE.Vector3();
  const toys = TOYS.map(([color, defs], ti) => {
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, sheen: 0.5, sheenRoughness: 0.9, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff'), 0.25), bumpMap: bump, bumpScale: 1.2 });
    const toy = { group: new THREE.Group(), k: ti ? 1 : 0, parts: [] };
    defs.forEach(([kind, size, pos, rz = 0], i) => {
      const mesh = new THREE.Mesh(geo[kind](size), mat);
      mesh.position.set(...pos);
      mesh.rotation.z = rz;
      mesh.geometry.computeBoundingSphere();
      const centre = mesh.geometry.boundingSphere.center.clone().applyEuler(mesh.rotation).add(mesh.position);
      const out = centre.lengthSq() > 0.01 ? centre.clone().normalize() : new THREE.Vector3(Math.random() - 0.5, 1, 0).normalize();
      toy.parts.push({
        mesh, home: mesh.position.clone(), rz, delay: i / defs.length,
        burst: out.multiplyScalar(2.2 + Math.random() * 1.6).add(new THREE.Vector3(0, Math.random() - 0.3, 1.5 + Math.random() * 2)),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6),
      });
      toy.group.add(mesh);
    });
    box.setFromObject(toy.group).getCenter(c);
    toy.group.position.copy(c).negate(); // centre each toy on the turntable
    group.add(toy.group);
    return toy;
  });

  // staggered, per part: the first parts leave first and land first
  function apply() {
    for (const toy of toys) {
      toy.group.visible = toy.k < 0.999;
      if (!toy.group.visible) continue;
      for (const p of toy.parts) {
        const e = Math.min(1, Math.max(0, (toy.k - p.delay * 0.3) / 0.7));
        p.mesh.position.copy(p.home).addScaledVector(p.burst, e);
        p.mesh.rotation.set(p.spin.x * e, p.spin.y * e, p.rz + p.spin.z * e);
        p.mesh.scale.setScalar(1 - e * e * e);
      }
    }
  }
  apply();
  return { group, toys, apply };
}
