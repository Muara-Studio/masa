// A small polite toast for buttons outside this study (login, cart, AR, journal...).
let el, timer;

export function note(text = 'Not part of this study. This recreation covers the homepage only.') {
  if (!el) {
    el = document.createElement('div');
    el.id = 'note';
    el.setAttribute('role', 'status');
  }
  // inside an open modal dialog, so it renders above it and is not inert
  (document.querySelector('dialog[open]') || document.body).append(el);
  el.textContent = '';
  clearTimeout(timer);
  // a beat later, so screen readers announce text that lands in a live region they already know
  timer = setTimeout(() => {
    el.textContent = text;
    el.classList.add('is-on');
    timer = setTimeout(() => el.classList.remove('is-on'), 3600);
  }, 60);
}
