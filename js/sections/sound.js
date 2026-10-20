// MASA Sound: a floating-island diorama under glass, tilted by the pointer, with the title rising in behind it.
import { SplitText } from 'gsap/SplitText.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { stage, hasGL } from '../lib/stage.js';
import { buildDiorama } from '../lib/diorama.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

export default function init(el, ctx) {
  const { gsap, reduced } = ctx;
  gsap.registerPlugin(SplitText);
  el.querySelectorAll('.pill').forEach((b) => {
    b.addEventListener('pointerenter', () => sfx.hover());
    b.addEventListener('click', () => { sfx.click(); note(); });
  });

  if (!reduced) {
    const title = el.querySelector('.sound-title');
    const split = SplitText.create(title, { type: 'words,chars', mask: 'words' });
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 70%', toggleActions: 'play none none reverse' } });
    tl.from(split.chars, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.045 })
      .from(el.querySelectorAll('.sound-date, .sound-tag, .sound-cta'), { autoAlpha: 0, y: 14, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.25);
  }

  if (!hasGL()) return el.classList.add('is-poster');
  island(el, ctx); // not awaited: the page boots while the island builds
}

async function island(el, { ScrollTrigger, reduced }) {
  const canvas = el.querySelector('canvas');
  const phone = matchMedia('(max-width: 767px)').matches;
  let s, d;
  try {
    s = stage(canvas, { fov: 30, dpr: phone ? 1.5 : 1.75 });
    d = await buildDiorama(s.THREE, { blades: phone ? 3200 : 7000, detail: phone ? 34 : 46, motion: reduced ? 0 : 1 });
  } catch (err) {
    console.error('[sound]', err);
    return el.classList.add('is-poster');
  }
  const { THREE, scene, camera, renderer } = s;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xa9bcff, 0x2b1d12, 0.35));
  const key = new THREE.DirectionalLight(0xfff0dc, 3); key.position.set(4, 3.2, 1.6); // raking, so the rock shows its relief
  const rim = new THREE.DirectionalLight(0x86aaff, 2.4); rim.position.set(-3, 1.2, -3.5);
  const under = new THREE.DirectionalLight(0xffc89a, 0.45); under.position.set(0.5, -2, 2.5);
  scene.add(key, rim, under);

  // tilt (pointer, world axes) wraps spin (yaw, bob)
  const tilt = new THREE.Group(), spin = new THREE.Group();
  spin.add(d.root); tilt.add(spin); scene.add(tilt);
  const target = new THREE.Vector3(0, -0.42, 0);

  s.resize = ({ w, h }) => {
    const v = (camera.fov * Math.PI) / 180, hz = 2 * Math.atan(Math.tan(v / 2) * (w / h));
    const dist = 1.16 / Math.sin(Math.min(v, hz) / 2);
    camera.position.set(0, target.y + Math.sin(0.42) * dist, Math.cos(0.42) * dist);
    camera.lookAt(target);
    d.resize(h * renderer.getPixelRatio() * 0.05);
  };
  s.resize(s);

  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0, scroll: 0 };
  let scroll = 0;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  el.addEventListener('pointerleave', () => { ptr.x = ptr.y = 0; });
  ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (st) => { scroll = st.progress - 0.5; } });

  const motion = reduced ? 0 : 1;
  s.frame = (t, dt) => {
    const k = 1 - Math.exp(-dt * 3); // frame-rate independent ease toward the pointer and scroll
    cur.x += (ptr.x - cur.x) * k; cur.y += (ptr.y - cur.y) * k; cur.scroll += (scroll * motion - cur.scroll) * k;
    tilt.rotation.set(cur.y * 0.07, 0, -cur.x * 0.06);
    spin.rotation.y = -0.35 + cur.x * 0.22 + cur.scroll * 0.8 + Math.sin(t * 0.15) * 0.2 * motion;
    spin.position.y = Math.sin(t * 0.8) * 0.035 * motion - cur.scroll * 0.2;
    d.update(t);
  };
}
