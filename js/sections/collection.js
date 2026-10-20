// Collection: four cards with covers drawn by covers.js. On wide screens the row slides one card left with scroll so
// the fourth card comes in; on phones (and with reduced motion) the rail is a native horizontal scroller.
import { cover } from '../lib/covers.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

export default function init(el, { gsap, reduced }) {
  el.querySelectorAll('[data-cover]').forEach((c, i) => { c.innerHTML = cover(c.dataset.cover, `cv${i}`); });
  el.querySelectorAll('button').forEach((b) => b.addEventListener('pointerenter', () => sfx.hover()));
  el.addEventListener('click', (e) => { if (e.target.closest('button')) { sfx.click(); note(); } });
  if (reduced) return;

  const rail = el.querySelector('.col__rail'), row = el.querySelector('.col__row');
  gsap.matchMedia().add('(min-width: 768px)', () => {
    rail.classList.add('is-scrub');
    gsap.to(row, {
      x: () => -(row.firstElementChild.offsetWidth + 24), ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 85%', scrub: true, invalidateOnRefresh: true },
    });
    return () => rail.classList.remove('is-scrub');
  });
  gsap.fromTo([...el.querySelectorAll('.col__title span, .col__head .pill, .col__card')], { y: 48, opacity: 0 }, {
    y: 0, opacity: 1, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 40%', scrub: true },
  });
}
