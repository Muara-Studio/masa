// Takeover: one serif line (with photos riding in it) crosses the sticky stage right to left; then a dashed path
// draws itself with a paper plane at its tip and curls down into the events list. All scrubbed by scroll.
export default function init(el, { gsap, reduced }) {
  if (reduced) return; // CSS wraps the line in place and hides the path

  const line = el.querySelector('.to__line');
  const photos = el.querySelectorAll('.to__ph img');
  const base = el.querySelector('.to__base');
  const reveal = el.querySelector('.to__reveal');
  const plane = el.querySelector('.to__plane');
  const L = base.getTotalLength();
  const fly = { p: 0 };

  const draw = () => {
    const s = fly.p * L, a = base.getPointAtLength(s), b = base.getPointAtLength(Math.min(s + 2, L)), c = base.getPointAtLength(Math.max(s - 2, 0));
    reveal.style.strokeDashoffset = 1 - fly.p;
    plane.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${Math.atan2(b.y - c.y, b.x - c.x) * 57.2958})`);
    plane.style.opacity = fly.p > 0.002 && fly.p < 0.985 ? 1 : 0;
  };

  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  })
    .fromTo(line, { x: () => innerWidth * 0.85 }, { x: () => -line.offsetWidth, duration: 0.64 }, 0.06)
    // photos drift against the line a little, each at its own rate, so the row reads as layered
    .fromTo(photos, { yPercent: (i) => [10, -8, 6][i] }, { yPercent: (i) => [-10, 8, -6][i], duration: 0.7 }, 0)
    // the path starts only once the line has left, so its loop never crosses the letters
    .to(base, { opacity: 1, duration: 0.04 }, 0.68)
    .to(fly, { p: 1, duration: 0.3, ease: 'power1.inOut', onUpdate: draw }, 0.7);
  draw();
}
