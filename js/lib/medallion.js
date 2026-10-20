// Brands emblem: a brushed-gold coin with an orchid over three waves in relief, on both faces. THREE is passed in.

export function buildMedallion(THREE) {
  const coin = new THREE.Group();
  // lathe-turned field (anisotropic, so highlights run in rings) under a polished relief
  const field = new THREE.MeshPhysicalMaterial({ color: 0xc8963f, metalness: 1, roughness: 0.38, anisotropy: 0.75 });
  const relief = new THREE.MeshStandardMaterial({ color: 0xe6bb62, metalness: 1, roughness: 0.24 });

  // body: profile from the back centre out over a raised rim to the front centre, turned about y, then faced to +z
  const F = 0.05, prof = [];
  for (let i = 0; i <= 12; i++) prof.push([0.84 * i / 12, -F]);
  prof.push([0.88, -0.088], [0.94, -0.104], [0.985, -0.092], [1, -0.055], [1, 0.055], [0.985, 0.092], [0.94, 0.104], [0.88, 0.088]);
  for (let i = 12; i >= 0; i--) prof.push([0.84 * i / 12, F]);
  const body = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96).rotateX(Math.PI / 2);
  coin.add(new THREE.Mesh(body, field));

  // relief: layered lobes, so each layer stands a little prouder than the one under it
  const lobe = (cx, cy, ang, len, w) => {
    const c = Math.cos(ang), s = Math.sin(ang), P = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
    const sh = new THREE.Shape();
    sh.moveTo(...P(0, 0));
    sh.bezierCurveTo(...P(len * 0.25, w), ...P(len * 0.95, w * 0.7), ...P(len, 0));
    sh.bezierCurveTo(...P(len * 0.95, -w * 0.7), ...P(len * 0.25, -w), ...P(0, 0));
    return sh;
  };
  const band = (cx, cy, r, w) => { // a half-ring: one crest line of a wave
    const sh = new THREE.Shape();
    sh.absarc(cx, cy, r + w / 2, 0, Math.PI, false);
    sh.absarc(cx, cy, r - w / 2, Math.PI, 0, true);
    return sh;
  };
  const dot = (cx, cy, r) => { const sh = new THREE.Shape(); sh.absarc(cx, cy, r, 0, Math.PI * 2, false); return sh; };
  const D = Math.PI / 180, oy = 0.14;
  const layers = [
    [0.03, [lobe(0, oy, 90 * D, 0.46, 0.13), lobe(0, oy, 210 * D, 0.44, 0.12), lobe(0, oy, 330 * D, 0.44, 0.12)]], // sepals
    [0.045, [lobe(0, oy, 36 * D, 0.4, 0.27), lobe(0, oy, 144 * D, 0.4, 0.27)]], // petals
    [0.06, [lobe(0, oy, -90 * D, 0.26, 0.14), lobe(0, oy, -56 * D, 0.15, 0.07), lobe(0, oy, -124 * D, 0.15, 0.07)]], // lip
    [0.075, [dot(0, oy, 0.055)]], // column
    [0.022, [-0.36, 0.36].flatMap((x) => [0.055, 0.11, 0.165].map((r) => band(x, -0.46, r, 0.032)))], // side waves
    [0.027, [0.055, 0.11, 0.165].map((r) => band(0, -0.52, r, 0.032))], // middle wave, a hair prouder so the crests never z-fight
  ];
  const face = new THREE.Group();
  for (const [depth, shapes] of layers) {
    const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.011, bevelSegments: 3, curveSegments: 20 });
    face.add(new THREE.Mesh(g, relief));
  }
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 12, 8), relief, 40);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; beads.setMatrixAt(i, m.makeTranslation(Math.cos(a) * 0.775, Math.sin(a) * 0.775, 0.004)); }
  face.add(beads);
  face.position.z = F - 0.006;
  const back = face.clone();
  back.scale.z = -1; back.position.z = -face.position.z;
  coin.add(face, back);
  return coin;
}
