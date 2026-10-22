// Collection: four cards with covers drawn by covers.js in a native horizontal rail; three show at 1440, as in the reference.
import { cover } from '../lib/covers.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

export default function init(el, { gsap, reduced }) {
  el.querySelectorAll('[data-cover]').forEach((c, i) => { c.innerHTML = cover(c.dataset.cover, `cv${i}`); });
  el.querySelectorAll('button').forEach((b) => b.addEventListener('pointerenter', () => sfx.hover()));
  el.addEventListener('click', (e) => { if (e.target.closest('button')) { sfx.click(); note(); } });
  if (reduced) return;

  gsap.fromTo([...el.querySelectorAll('.col__title span, .col__head .pill, .col__card')], { y: 48, opacity: 0 }, {
    y: 0, opacity: 1, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 40%', scrub: true },
  });
}
