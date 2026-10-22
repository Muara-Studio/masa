// Gardens by the Bay: a sticky stage over 400dvh; the papercraft tiger walks in over the title and lies down mid-stage, all scrubbed.
import { stage, hasGL } from '../lib/stage.js';
import { makeTiger } from '../lib/tiger.js';
import { note } from '../lib/note.js';

export default function init(el, { ScrollTrigger, reduced }) {
  el.querySelector('.pill').addEventListener('click', () => note());
  ScrollTrigger.create({ trigger: el, start: 'top 70%', once: true, onEnter: () => el.classList.add('is-in') });

  let p = 0;
  ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (st) => { p = st.progress; } });

  if (!hasGL()) return el.classList.add('no-gl');
  try {
    const s = stage(el.querySelector('canvas'), { fov: 30, dpr: innerWidth < 768 ? 1.5 : 1.75 });
    const { THREE, scene, camera } = s;
    const tiger = makeTiger(THREE);
    scene.add(tiger.root);
    // warm key from the upper left, cool rim from behind; a low hemisphere keeps the paper facets distinct
    scene.add(new THREE.HemisphereLight('#7d8bb3', '#8a5a34', 0.7));
    const key = new THREE.DirectionalLight('#ffd3a0', 3.4), rim = new THREE.DirectionalLight('#86b0ff', 4.5), fill = new THREE.DirectionalLight('#ffb27a', 0.5);
    key.position.set(-6, 8, 5);
    rim.position.set(3, 4, -6);
    fill.position.set(3, -1, 6);
    scene.add(key, rim, fill);

    // fit: the tiger fills about half the height on desktop and most of the width on phones; paws on a line below the title
    let span = 10;
    s.resize = ({ w, h }) => {
      const asp = w / h, tan = Math.tan((camera.fov * Math.PI) / 360);
      const vh = Math.max(tiger.height / 0.52, tiger.length / (asp < 1 ? 0.9 : 0.82) / asp);
      const dist = vh / 2 / tan, ground = asp < 1 ? 0.63 : 0.69;
      camera.position.set(0, (2 * ground - 1) * (vh / 2), dist);
      span = vh * asp;
    };
    s.resize(s);

    let shown = -1;
    s.frame = (t, dt) => {
      if (reduced) return tiger.pose(span * 0.12 - 3, 0.5, 1); // static: lying mid-stage, as the scroll leaves it
      shown = shown < 0 ? p : shown + (p - shown) * (1 - Math.exp(-dt * 5)); // eased follow, so the gait settles after the wheel stops
      // walk in from off the left edge, slowing to a stop with the head at ~62% of the width (p .06 to .67), then lie down (.67 to .85)
      const w = Math.min(Math.max((shown - 0.06) / 0.61, 0), 1), l = Math.min(Math.max((shown - 0.67) / 0.18, 0), 1);
      const d = span * (-0.62 + 0.74 * (1 - (1 - w) ** 1.3)) - 3;
      tiger.pose(d, 0.5 * l * l * (3 - 2 * l), l * l * (3 - 2 * l));
    };
  } catch (err) {
    console.error('[gbtb]', err);
    el.classList.add('no-gl');
  }
}
