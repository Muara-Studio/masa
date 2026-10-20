// Events: hairline list. The active row (hovered, focused, or else the one at screen centre) dims the others and
// gets a full-bleed photo band behind it; the band glides between rows with lag and its photo drifts with scroll.
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

export default function init(el, { gsap, ScrollTrigger, reduced }) {
  const wrap = el.querySelector('.ev__wrap');
  const band = el.querySelector('.ev__band');
  const imgs = [...band.querySelectorAll('img')];
  const rows = [...el.querySelectorAll('.ev__item')];
  const yTo = gsap.quickTo(band, 'y', { duration: reduced ? 0 : 0.7, ease: 'power3' });
  let hover = -1, focus = -1, centre = -1, cur = -1;

  const update = () => {
    const i = hover >= 0 ? hover : focus >= 0 ? focus : centre;
    if (i === cur) return;
    const was = cur;
    cur = i;
    wrap.classList.toggle('is-active', i >= 0);
    rows.forEach((r, j) => r.classList.toggle('is-on', j === i));
    imgs.forEach((im, j) => im.classList.toggle('is-on', j === i));
    if (i < 0) return;
    // first activation lands in place and opens; after that the band slides from row to row
    if (was < 0) place(); else yTo(bandY(i));
  };
  const bandY = (i) => rows[i].offsetTop + rows[i].offsetHeight / 2 - band.offsetHeight / 2;
  const place = () => { if (cur >= 0) { const y = bandY(cur); gsap.set(band, { y }); yTo(y, y); } };

  rows.forEach((r, i) => {
    r.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = i; sfx.hover(); update(); } });
    r.addEventListener('focusin', () => { focus = i; update(); });
    r.addEventListener('focusout', () => { focus = -1; update(); });
    ScrollTrigger.create({
      trigger: r, start: 'top center', end: 'bottom center',
      onToggle: (st) => { if (st.isActive) centre = i; else if (centre === i) centre = -1; update(); },
    });
  });
  wrap.addEventListener('pointerleave', () => { hover = -1; update(); });
  el.addEventListener('click', (e) => { if (e.target.closest('button')) { sfx.click(); note(); } });
  el.querySelector('.pill').addEventListener('pointerenter', () => sfx.hover());
  ScrollTrigger.addEventListener('refresh', place);

  if (reduced) return;
  gsap.fromTo(band.firstElementChild, { yPercent: -12 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true } });
  // names rise out of their own line box, meta follows, row after row
  rows.forEach((r) => gsap.fromTo([r.querySelector('.ev__name span'), r.querySelector('.ev__meta')], { yPercent: 110, opacity: 0 }, {
    yPercent: 0, opacity: 1, stagger: 0.15, ease: 'power3.out',
    scrollTrigger: { trigger: r, start: 'top 96%', end: 'top 70%', scrub: true },
  }));
}
