// Boot: smooth scroll, ScrollTrigger, the enter gate, and one module per [data-module] element.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
if (q.has('nogl')) root.classList.add('no-gl');

history.scrollRestoration = 'manual';
scrollTo(0, 0);

const lenis = new Lenis({ autoRaf: false, lerp: reduced ? 1 : 0.1, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

const ctx = { gsap, ScrollTrigger, lenis, q, reduced };
window.MASA = ctx; // dev handle: MASA.lenis.scrollTo(4200)

let entered = false;
function enter() {
  if (entered) return;
  entered = true;
  root.classList.add('is-entered');
  dispatchEvent(new Event('masa:enter'));
  lenis.start();
}
ctx.enter = enter;
// the hero owns the gate and calls ctx.enter() when its intro has played; a click anywhere on the gate is the fallback
document.getElementById('gate')?.addEventListener('click', () => ctx.onGate ? ctx.onGate() : enter());
addEventListener('keydown', (e) => { if (!entered && (e.key === 'Enter' || e.key === ' ')) document.getElementById('gate')?.click(); });

const mods = [...document.querySelectorAll('[data-module]')].map((el) =>
  import(`./sections/${el.dataset.module}.js`)
    .then((m) => m.default(el, ctx))
    .catch((err) => { console.error(`[${el.dataset.module}]`, err); el.classList.add('is-broken'); })
);

// dev: ?skip enters at once, ?y=4200 jumps there after entering
Promise.all(mods).then(() => {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (q.has('skip') || q.has('y')) {
    enter();
    const y = +q.get('y') || 0;
    if (y) requestAnimationFrame(() => { lenis.scrollTo(y, { immediate: true, force: true }); ScrollTrigger.update(); });
  }
});
addEventListener('load', () => ScrollTrigger.refresh());
