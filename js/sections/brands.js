// Brands: the section lights from black to paper as it arrives; drawn cards drift at depth round a turning gold medallion.
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { stage, hasGL } from '../lib/stage.js';
import { buildMedallion } from '../lib/medallion.js';
import { cover } from '../lib/covers.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

// [left %, top %, size px, depth, tile, rotation°, aspect]: product covers come from C's covers.js, the rest are CSS textiles
const CARDS = [
  [13, 24, 82, 0.9, 'journal', -5, 1], [28, 66, 52, 0.45, 'lurik', 4, 1.25], [33, 12, 40, 0.3, 'dots', 0, 1],
  [67, 14, 60, 0.6, 'mega', 3, 1], [83, 36, 92, 1, 'candle', -3, 1.15], [72, 74, 46, 0.35, 'check', 6, 1],
  [9, 72, 64, 0.7, 'postcards', -2, 1.25], [89, 80, 42, 0.5, 'dots2', 0, 1], [41, 88, 38, 0.25, 'kawung', 2, 1],
  [59, 90, 56, 0.55, 'colouring', -4, 0.85],
];

export default function init(el, { gsap, ScrollTrigger, reduced }) {
  const btn = el.querySelector('.pill');
  btn.addEventListener('pointerenter', () => sfx.hover());
  btn.addEventListener('click', () => { sfx.click(); note(); });

  // a second copy of the wordmarks makes the marquee seamless; it is hidden from assistive tech
  const list = el.querySelector('.brands-list'), copy = list.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true'); copy.removeAttribute('aria-label');
  list.after(copy);

  const box = el.querySelector('.brands-cards');
  const cards = CARDS.map(([x, y, s, d, tile, r, ar], i) => {
    const c = document.createElement('i');
    c.className = 'card ' + tile;
    c.style.cssText = `--x:${x}%;--y:${y}%;--s:${s}px;--r:${r}deg;--ar:${ar}`;
    if (!c.matches('.lurik,.dots,.mega,.check,.dots2,.kawung')) { c.innerHTML = cover(tile, `e-card${i}`); c.style.overflow = 'hidden'; }
    box.append(c);
    return { c, d };
  });

  // black to paper, scrubbed; the heading rises as the light comes up
  const lines = el.querySelectorAll('.brands-line > span');
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 20%', scrub: 0.6, onUpdate: (st) => el.classList.toggle('on-light', st.progress > 0.5) },
  });
  tl.fromTo(el, { '--bg': '#000000', '--fg': '#f3f3f3' }, { '--bg': '#f9f8f8', '--fg': '#1e1e1e' }, 0)
    .fromTo(cards.map((k) => k.c), { opacity: 0 }, { opacity: 1, stagger: 0.03 }, 0.25);
  if (!reduced) tl.fromTo(lines, { yPercent: 105 }, { yPercent: 0, ease: 'power3.out', stagger: 0.12 }, 0.1);

  // depth parallax: scroll moves near cards more, the pointer nudges them; written once per frame while on screen
  if (!reduced) {
    let p = 0, on = false;
    const m = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom top', onUpdate: (st) => { p = st.progress - 0.5; }, onToggle: (st) => { on = st.isActive; } });
    el.addEventListener('pointermove', (e) => { m.x = e.clientX / innerWidth - 0.5; m.y = e.clientY / innerHeight - 0.5; });
    gsap.ticker.add((_, dms) => {
      if (!on) return;
      const k = 1 - Math.exp(-dms / 1000 * 3);
      cur.x += (m.x - cur.x) * k; cur.y += (m.y - cur.y) * k;
      for (const { c, d } of cards) c.style.transform = `translate3d(${(cur.x * 36 * d).toFixed(1)}px, ${(-p * 220 * d + cur.y * 26 * d).toFixed(1)}px, 0)`;
    });
  }

  if (!hasGL()) return el.classList.add('is-poster');
  try { medal(el, reduced); } catch (err) { console.error('[brands]', err); el.classList.add('is-poster'); }
}

function medal(el, reduced) {
  const s = stage(el.querySelector('.brands-medal canvas'), { fov: 22, dpr: matchMedia('(max-width: 767px)').matches ? 1.5 : 1.75 });
  const { THREE, scene, camera, renderer } = s;
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff2dc, 2.2); key.position.set(2, 3, 4);
  scene.add(key);
  const coin = buildMedallion(THREE);
  scene.add(coin);
  camera.position.set(0, 0, 1.16 / Math.sin((22 * Math.PI) / 360));
  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  el.addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; });
  let spin = -0.45;
  s.frame = (t, dt) => {
    const k = 1 - Math.exp(-dt * 3);
    cur.x += (ptr.x - cur.x) * k; cur.y += (ptr.y - cur.y) * k;
    if (!reduced) spin += dt * 0.55;
    coin.rotation.set(0.12 + cur.y * 0.5, spin + cur.x * 0.6, 0);
  };
}
