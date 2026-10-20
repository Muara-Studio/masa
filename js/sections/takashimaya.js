// Takashimaya: a turntable of four block toys; arrows (or keyboard arrows) blow the current toy apart and assemble the next.
import { stage, hasGL } from '../lib/stage.js';
import { makeToys } from '../lib/toys.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

const TAU = Math.PI * 2;
const NAMES = ['a bird', 'a little house', 'a flower in a pot', 'an M that stands like a figure'];
const COLORS = ['#2f3fb8', '#ef6a2a', '#7fb3ff', '#ef6a2a'];

export default function init(el, { gsap, ScrollTrigger, reduced }) {
  const canvas = el.querySelector('canvas'), count = el.querySelector('.count');
  let cur = 0, set = null, inView = false;
  const rot = { spin: -0.45, vel: 0 };

  const go = (dir) => {
    const prev = cur;
    cur = (cur + dir + 4) % 4;
    sfx.click();
    count.textContent = `(0${cur + 1})`;
    canvas.setAttribute('aria-label', `Block toy ${cur + 1} of 4: ${NAMES[cur]}`);
    el.style.setProperty('--toy', COLORS[cur]);
    if (!set) return;
    const a = set.toys[prev], b = set.toys[cur];
    if (reduced) { a.k = 1; b.k = 0; rot.spin = -0.45; return; }
    gsap.to(a, { k: 1, duration: 0.7, ease: 'power2.in', overwrite: true });
    gsap.fromTo(b, { k: 1 }, { k: 0, duration: 1.5, delay: 0.3, ease: 'expo.out', overwrite: true });
    // the flat-fronted toys read best three-quarter on: turn the table to the nearest such angle while the next one lands
    const off = (((rot.spin + 0.45) % TAU) + TAU) % TAU;
    rot.vel = 0;
    gsap.to(rot, { spin: rot.spin - (off > Math.PI ? off - TAU : off), duration: 1.6, ease: 'power3.inOut', overwrite: true });
  };
  el.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.dir)));
  el.querySelector('.pill').addEventListener('click', () => note());
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.5 }).observe(el);
  addEventListener('keydown', (e) => {
    if (!inView || e.altKey || e.metaKey || e.ctrlKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });
  ScrollTrigger.create({ trigger: el, start: 'top 70%', once: true, onEnter: () => el.classList.add('is-in') });

  if (!hasGL()) return el.classList.add('no-gl');
  try {
    const s = stage(canvas, { fov: 30, dpr: innerWidth < 768 ? 1.5 : 1.75 });
    const { THREE, scene, camera } = s;
    set = makeToys();
    const table = set.group;
    table.rotation.x = 0.22; // tipped toward us, so the tops read
    scene.add(table);
    scene.add(new THREE.HemisphereLight('#e4e9ff', '#20202a', 0.9));
    const key = new THREE.DirectionalLight('#fff3e6', 2.2), rim = new THREE.DirectionalLight('#a9bcff', 1.4);
    key.position.set(3, 5, 6);
    rim.position.set(-5, 2, -4);
    scene.add(key, rim);

    // toy a little over half the section height, centred at 45% from the top; narrower on phones
    s.resize = ({ w, h }) => {
      const asp = w / h, tan = Math.tan((camera.fov * Math.PI) / 360);
      const vh = Math.max(3.2 / 0.56, 3.8 / 0.72 / asp);
      camera.position.set(0, 0, vh / 2 / tan);
      table.position.y = 0.1 * (vh / 2);
    };
    s.resize(s);

    // drag to spin with a little inertia, then ease back to the idle turn
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; gsap.killTweensOf(rot); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (drag === null) return;
      const dx = e.clientX - drag;
      drag = e.clientX;
      rot.spin += dx * 0.01;
      rot.vel = dx * 0.6;
    });
    for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, () => { drag = null; });

    s.frame = (t, dt) => {
      if (drag === null) {
        rot.vel += ((reduced ? 0 : 0.25) - rot.vel) * (1 - Math.exp(-dt * 1.5));
        rot.spin += rot.vel * dt;
      }
      table.rotation.y = rot.spin;
      set.apply();
    };
  } catch (err) {
    console.error('[takashimaya]', err);
    set = null;
    el.classList.add('no-gl');
  }
}
