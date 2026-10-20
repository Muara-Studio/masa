// Shell: ticker, header, menu overlay, HUD, footer form, and smooth scrolling for every in-page link.
import { sfx } from '../lib/sfx.js';
import { note } from '../lib/note.js';

const PRODUCTS = ['ORCHID FIELD JOURNAL', 'TENUN POSTCARD SET', 'MEGAMENDUNG COLOURING BOOK', 'CLOVE & SMOKE CANDLE'];

// format check only (nothing is ever sent): name@domain.tld, no spaces, no empty labels
export const isEmail = (v) => v.trim().length <= 254 && /^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/.test(v.trim());

export default function init(el, { gsap, ScrollTrigger, lenis, reduced }) {
  const root = document.documentElement;
  const header = el.querySelector('#site-header');
  const hud = el.querySelector('#hud');
  const menu = el.querySelector('#menu');
  const burger = header.querySelector('.hd__burger');
  const footer = document.getElementById('site-footer');

  // ticker: fill one set past the widest screen, then a twin set so translateX(-50%) loops seamlessly
  const track = el.querySelector('.tk__track'), set = track.firstElementChild;
  document.fonts.ready.then(() => {
    const unit = [...set.children];
    if (!set.offsetWidth) return;
    while (set.offsetWidth < Math.max(screen.width, innerWidth) + 200) set.append(...unit.map((n) => n.cloneNode(true)));
    track.append(set.cloneNode(true));
    track.style.animationDuration = `${set.offsetWidth / 45}s`;
  });

  // past the top, the ticker slides away and the header takes its place
  const onScroll = () => el.classList.toggle('is-scrolled', lenis.scroll > 40);
  lenis.on('scroll', onScroll);
  onScroll();

  // header and HUD switch to ink while a light section sits under them; .on-light is read live because sections may toggle it
  const secs = [...document.querySelectorAll('#content > section, #site-footer')];
  const under = (at) => {
    let cur = null;
    for (const sec of secs) ScrollTrigger.create({ trigger: sec, start: `top ${at}`, end: `bottom ${at}`, onToggle: (st) => { if (st.isActive) cur = sec; else if (cur === sec) cur = null; } });
    return () => !!cur?.classList.contains('on-light');
  };
  const headerLight = under('28px'), hudLight = under('bottom-=40');
  const tone = () => { header.classList.toggle('is-light', headerLight()); hud.classList.toggle('is-light', hudLight()); };
  lenis.on('scroll', tone);
  ScrollTrigger.addEventListener('refresh', tone);

  // AR and the product card belong to the hero; past it only SOUND stays
  const hero = document.getElementById('hero');
  if (hero) ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom 75%', onToggle: (st) => hud.classList.toggle('is-hero', st.isActive) });
  else hud.classList.add('is-hero');

  // the HUD rides up with the top of the footer instead of sitting on it
  if (footer) gsap.to(hud, { y: () => -innerHeight, ease: 'none', scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true } });

  const enterIn = () => {
    if (reduced) return;
    gsap.from(header.querySelectorAll('.hd__burger, .hd__nav a, .hd__mark, .hd__r > *'), { y: -14, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05, delay: 0.15 });
    gsap.from(hud.querySelector('.hud__sound'), { y: 14, autoAlpha: 0, duration: 1.2, ease: 'expo.out', delay: 0.4 }); // AR and the card enter by CSS transition
  };
  if (!root.classList.contains('is-entered')) addEventListener('masa:enter', enterIn, { once: true });

  // menu: a modal <dialog> gives Esc, inert background and focus containment; we add the wipe
  const rows = menu.querySelectorAll('.mn__list li > *');
  const shut = () => { menu.close(); lenis.start(); burger.setAttribute('aria-expanded', 'false'); };
  function openMenu() {
    if (menu.open) return;
    menu.showModal();
    lenis.stop();
    burger.setAttribute('aria-expanded', 'true');
    sfx.whoosh();
    if (reduced) return;
    gsap.killTweensOf(menu);
    gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut' });
    gsap.fromTo(rows, { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.045, delay: 0.3 });
    gsap.fromTo(menu.querySelectorAll('.mn__bar, .mn__foot'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.45 });
  }
  function closeMenu(jump) {
    if (!menu.open) return;
    sfx.whoosh();
    if (reduced || jump) return shut();
    gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'power3.inOut', onComplete: () => { shut(); burger.focus(); } });
  }
  burger.addEventListener('click', openMenu);
  menu.querySelector('.mn__close').addEventListener('click', () => closeMenu());
  menu.addEventListener('cancel', (e) => { e.preventDefault(); closeMenu(); });
  menu.addEventListener('close', () => { lenis.start(); burger.setAttribute('aria-expanded', 'false'); }); // a forced close (second Esc) skips the wipe

  // in-page links scroll with Lenis; out-of-scope buttons show the note
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-note]')) return note();
    const a = e.target.closest('a[href^="#"]'), id = a?.getAttribute('href');
    const target = id && id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    closeMenu(true);
    lenis.scrollTo(target, { offset: -84, immediate: reduced });
    if (e.detail === 0) { // keyboard: move focus along so the next Tab continues from the section
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    } else if (document.activeElement === burger) burger.blur(); // the dialog hands focus back; a pointer user needs no ring there
  });

  // UI sounds for the shell's own controls (no-ops until SOUND is on)
  for (const r of [el, footer]) {
    r?.addEventListener('pointerover', (e) => { const b = e.target.closest('a, button'); if (b && !b.contains(e.relatedTarget)) sfx.hover(); });
    r?.addEventListener('click', (e) => { if (e.target.closest('a, button')) sfx.click(); });
  }

  const sound = hud.querySelector('.hud__sound');
  sound.addEventListener('click', () => {
    sfx.toggle();
    sound.setAttribute('aria-pressed', String(sfx.on));
    hud.classList.toggle('is-sound', sfx.on);
  });

  // mini product card: the active bar's CSS fill times the cycle, so hover/focus pauses it for free
  const card = hud.querySelector('.hud__card');
  const bars = card.querySelectorAll('.card__bars i'), name = card.querySelector('.card__name');
  const count = card.querySelector('.card__count'), thumb = card.querySelector('.card__thumb');
  let i = 0;
  const show = (n) => {
    i = (n + PRODUCTS.length) % PRODUCTS.length;
    bars.forEach((b, k) => { b.classList.toggle('is-done', k < i); b.classList.toggle('is-active', k === i); });
    count.textContent = `${i + 1}/${PRODUCTS.length}`;
    name.textContent = PRODUCTS[i];
    thumb.dataset.i = i;
    if (reduced) return;
    const roll = { duration: 900, easing: 'cubic-bezier(.22, 1, .36, 1)' }; // WAAPI: runs off the main thread, like the CSS bar that drives it
    name.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], roll);
    thumb.animate([{ transform: 'scale(1.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], roll);
  };
  if (!reduced) card.addEventListener('animationend', (e) => { if (e.target.classList.contains('is-active')) show(i + 1); });
  card.querySelector('.card__next').addEventListener('click', () => show(i + 1));

  // newsletter: local format check and a success state; the form has no action and never sends
  const form = footer?.querySelector('.ft__nl');
  if (form) {
    const input = form.querySelector('input'), msg = form.querySelector('.ft__msg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isEmail(input.value)) {
        input.setAttribute('aria-invalid', 'true');
        msg.textContent = 'Please check the address, like name@example.com.';
        input.focus();
        return;
      }
      form.classList.add('is-done');
      msg.textContent = "You're on the list. See you in Singapore.";
      msg.tabIndex = -1;
      msg.focus();
    });
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); msg.textContent = ''; });
  }
}
