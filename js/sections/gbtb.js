// Gardens by the Bay: a sticky stage over 400dvh; the papercraft tiger walks across the title as you scroll.
import { stage, hasGL } from '../lib/stage.js';
import { makeTiger, STRIDE } from '../lib/tiger.js';
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
      const vh = Math.max(tiger.height / 0.5, tiger.length / (asp < 1 ? 0.9 : 0.8) / asp);
      const dist = vh / 2 / tan, ground = asp < 1 ? 0.63 : 0.78;
      camera.position.set(0, (2 * ground - 1) * (vh / 2), dist);
      span = vh * asp;
    };
    s.resize(s);

    let shown = -1;
    s.frame = (t, dt) => {
      if (reduced) return tiger.pose(STRIDE * 0.55, 0.3); // static, mid-stride, facing us a little
      shown = shown < 0 ? p : shown + (p - shown) * (1 - Math.exp(-dt * 5)); // eased follow, so the gait settles after the wheel stops
      const d = -(span / 2 + 3.2) + (span + 7.4) * shown; // head enters at the left edge, tail tip leaves at the right
      tiger.pose(d, 0.45 * Math.sin(Math.PI * shown) ** 4);
    };
  } catch (err) {
    console.error('[gbtb]', err);
    el.classList.add('no-gl');
  }
}
