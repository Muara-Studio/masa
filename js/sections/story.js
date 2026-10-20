// Story: words light from dim to paper word by word as you scroll; the inline photos scale in as their turn comes.
import { SplitText } from 'gsap/SplitText.js';
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

export default function init(el, { gsap, reduced }) {
  const pill = el.querySelector('.pill');
  pill.addEventListener('pointerenter', () => sfx.hover());
  pill.addEventListener('click', () => { sfx.click(); note(); });
  if (reduced) return; // CSS already shows the lit paragraph

  gsap.registerPlugin(SplitText);
  const text = el.querySelector('.st__text');
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  // split each text run on its own so the photos keep their place in reading order; aria 'none' because an
  // aria-label on a plain span is ignored, and the word spans read fine as they are
  const items = [...text.children].flatMap((n) => n.classList.contains('st__img') ? [n] : SplitText.create(n, { type: 'words', tag: 'span', aria: 'none' }).words);

  const tl = gsap.timeline({ scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 48%', scrub: true } });
  items.forEach((it, i) => {
    if (it.classList.contains('st__img')) {
      tl.fromTo(it, { scale: 0, rotate: -8 }, { scale: 1, rotate: 0, duration: 2.4, ease: 'back.out(1.5)' }, i * 0.5);
      tl.fromTo(it.firstElementChild, { scale: 1.5 }, { scale: 1, duration: 3, ease: 'power2.out' }, i * 0.5);
    } else tl.fromTo(it, { color: '#3a3a3a' }, { color: paper, duration: 1.2, ease: 'none' }, i * 0.5);
  });
  tl.fromTo(pill, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 2, ease: 'power3.out' }, '>-1');
}
