// Hero: loader ring, decrypting title, orchid sprays (defocused on the gate, lit after entry), and the ink transition into the site.
import { stage, hasGL } from '../lib/stage.js';
import { createInk } from '../lib/ink.js';
import { sfx } from '../lib/sfx.js';
import { sprayLayout, flowerGeometry, buildSpray } from '../lib/orchid.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CAM_Z = 10, FOV = 35, TAN = Math.tan((FOV * Math.PI) / 360), GATE_BLUR = 22;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);

// disc blur over the mip chain of the sprays' render target: cheap depth of field for the gate
const BLUR = /* glsl */ `
uniform sampler2D tMap; uniform float uBlur; uniform vec2 uPx;
varying vec2 vUv;
void main() {
  float lod = log2(max(uBlur * .45, 1.));
  vec4 c = textureLod(tMap, vUv, lod) * .16;
  for (int i = 0; i < 14; i++) {
    float fi = float(i), a = fi * 2.39996, d = sqrt((fi + .5) / 14.);
    c += textureLod(tMap, vUv + vec2(cos(a), sin(a)) * d * uBlur * uPx, lod) * (.84 / 14.);
  }
  gl_FragColor = c;
}`;

function orchids(canvas, st, { mobile, reduced, gsap, scroll }) {
  const s = stage(canvas, { fov: FOV, dpr: mobile ? 1.5 : 1.75 });
  const { THREE, renderer, scene, camera } = s;
  camera.position.set(0, 0, CAM_Z);
  const key = new THREE.Vector3(-0.45, 0.6, 0.66).normalize();
  const geo = flowerGeometry(THREE), root = new THREE.Group();
  scene.add(root);
  const sprays = sprayLayout(mobile).map((spec, i) => {
    const sp = buildSpray(THREE, spec, geo, key);
    root.add(sp.group);
    return { ...spec, ...sp, delay: i * 0.07, ph: i * 1.7 };
  });

  const rt = new THREE.WebGLRenderTarget(1, 1, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cu = { tMap: { value: rt.texture }, uBlur: { value: 0 }, uPx: { value: new THREE.Vector2(1, 1) } };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: cu, fragmentShader: BLUR, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  }));
  quad.frustumCulled = false;
  scene.add(quad);
  s.resize = () => {
    const pr = renderer.getPixelRatio(), w = Math.ceil(s.w * pr), h = Math.ceil(s.h * pr);
    rt.setSize(w, h); cu.uPx.value.set(1 / w, 1 / h);
  };
  s.resize();
  renderer.compile(scene, camera);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  const ease = gsap.parseEase('power3.inOut');

  s.frame = (t, dt) => {
    const f = 1 - Math.exp(-dt * 2.5), aspect = camera.aspect, sp = scroll.progress();
    mouse.x += (mouse.tx - mouse.x) * f; mouse.y += (mouse.ty - mouse.y) * f;
    const unit = Math.min(1, (aspect / 1.6) * (aspect < 0.8 ? 1.4 : 1));
    for (const o of sprays) {
      const mi = reduced ? st.m : ease(clamp01((st.m - o.delay) / 0.72));
      const k = (1 - mi) * (1 + 0.7 * (1 - st.d)); // 0 at the hero pose, 1 at the gate pose, more while drifting in
      const hh = (CAM_Z - o.z) * TAN, hw = hh * aspect;
      o.group.position.set((o.x + o.gx * k) * hw + mouse.x * o.par, (o.y + o.gy * k) * hh - mouse.y * o.par * 0.6, o.z);
      o.group.rotation.set(mouse.y * 0.05, mouse.x * 0.08, o.r + o.gr * k + (reduced ? 0 : Math.sin(t * 0.21 + o.ph) * 0.035));
      o.group.scale.setScalar(o.s * unit);
      o.uniforms.uSway.value = reduced ? 0 : Math.sin(t * 0.5 + o.ph) * 0.05 + Math.sin(t * 1.27 + o.ph * 2.3) * 0.015;
    }
    // scroll lifts the sprays faster than the page and pushes in a little
    root.position.y = sp * 6.5;
    root.scale.setScalar(1 + sp * 0.18);

    const blur = st.blur * renderer.getPixelRatio() * (mobile ? 0.6 : 1);
    quad.visible = false; root.visible = true;
    if (blur > 0.3) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
      quad.visible = true; root.visible = false; cu.uBlur.value = blur;
    }
  };
}

export default function init(el, ctx) {
  const { gsap, q, reduced } = ctx;
  const skip = q.has('skip') || q.has('y');
  const mobile = matchMedia('(max-width: 767px)').matches;
  const $ = (sel) => el.querySelector(sel);
  const gate = $('#gate'), label = $('.hero-enter'), loader = $('.hero-loader'), fade = $('.hero-fade');

  // the title becomes glyph slots so the decrypt never shifts the layout
  const chars = [];
  for (const ln of el.querySelectorAll('.hero-line')) {
    const txt = ln.textContent;
    ln.textContent = '';
    for (const c of txt) {
      const sp = document.createElement('span');
      sp.className = 'ch'; sp.textContent = c;
      if (c !== ' ' && !skip && !reduced) { sp.dataset.g = ''; chars.push(sp); }
      ln.append(sp);
    }
  }
  el.classList.add('is-live');

  const scroll = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.8 } })
    .to($('.hero-title'), { yPercent: -12, ease: 'none', duration: 1 }, 0)
    .to($('.hero-scroll span'), { opacity: 0, ease: 'none', duration: 0.2 }, 0);

  const st = { d: skip ? 1 : 0, m: skip ? 1 : 0, blur: skip ? 0 : GATE_BLUR };
  let gl = false, ink = null;
  if (hasGL()) {
    try {
      orchids($('.hero-gl'), st, { mobile, reduced, gsap, scroll });
      if (!skip && !reduced) ink = createInk($('.hero-ink'));
      gl = true;
    } catch (err) { console.warn('[hero] no WebGL, static fallback', err); }
  }
  if (!gl) el.classList.add('is-static');

  let revealed = !chars.length;
  function reveal(instant) {
    if (revealed) return;
    revealed = true;
    if (instant) { chars.forEach((c) => c.removeAttribute('data-g')); return; }
    const a = chars.map((_, i) => i * 0.045 + Math.random() * 0.25), b = a.map((x) => x + 0.35 + Math.random() * 0.5);
    const o = { t: 0 }, end = Math.max(...b);
    gsap.to(o, {
      t: end, duration: end, ease: 'none',
      onUpdate: () => chars.forEach((c, i) => {
        if (o.t >= b[i]) c.removeAttribute('data-g');
        else c.dataset.g = o.t < a[i] ? '' : GLYPHS[(Math.floor(o.t * 22) * 7 + i * 13) % 26];
      }),
      onComplete: () => chars.forEach((c) => c.removeAttribute('data-g')), // gsap rounds o.t, so the last glyph may never pass its end
    });
  }

  let gone = skip;
  const click = { x: 0.5, y: 0.5 };
  gate.addEventListener('pointerdown', (e) => { click.x = e.clientX / innerWidth; click.y = 1 - e.clientY / innerHeight; click.ptr = true; });
  ctx.onGate = () => {
    if (gone) return;
    gone = true;
    reveal(true);
    gsap.to([label, loader], { opacity: 0, duration: 0.3, overwrite: true });
    const done = () => { ctx.enter(); sfx.whoosh(); el.classList.remove('is-inking'); };
    if (!ink) {
      // reduced motion or no WebGL: a quick fade instead of the ink
      gsap.to(fade, { opacity: 1, duration: 0.45, ease: 'power1.inOut', onComplete: () => { st.m = 1; st.blur = 0; done(); gsap.set(fade, { opacity: 0 }); } });
      return;
    }
    if (!click.ptr) { const r = label.getBoundingClientRect(); click.x = (r.left + r.width / 2) / innerWidth; click.y = 1 - (r.top + r.height / 2) / innerHeight; }
    ink.uClick.value.set(click.x, click.y);
    el.classList.add('is-inking');
    gsap.timeline()
      .to(st, { m: 1, duration: 2.3, ease: 'none' }, 0)
      .to(st, { blur: 0, duration: 1.3, ease: 'power2.inOut' }, 0.1)
      .to(ink.uP, { value: 1, duration: 1.6, ease: 'power1.inOut' }, 0)
      .call(done, null, 1.6)
      .timeScale(q.has('slow') ? 1 / (+q.get('slow') || 10) : 1); // dev: ?slow=20 stretches the transition for captures
  };

  if (skip) { loader.style.display = 'none'; return; }
  (async () => {
    const p = { v: 0 }, pct = $('.hero-loader-pct'), arc = $('.hero-loader-arc');
    const draw = () => { arc.style.strokeDashoffset = 1 - p.v; pct.textContent = `${Math.round(p.v * 100)}%`; };
    // the ring always reads for a beat, and waits for Marcellus so the decrypt never swaps fonts mid-scramble
    await Promise.all([document.fonts.ready, gsap.to(p, { v: 0.9, duration: reduced ? 0.2 : 1.1, ease: 'power2.out', onUpdate: draw })]);
    await gsap.to(p, { v: 1, duration: reduced ? 0.1 : 0.35, ease: 'power1.out', onUpdate: draw });
    if (gone) return;
    gsap.to(loader, { opacity: 0, scale: 0.94, duration: 0.7, ease: 'power3.out' });
    reveal(reduced);
    gsap.to(st, { d: 1, duration: reduced ? 0 : 3.2, ease: 'expo.out' });
    gsap.to(label, { opacity: 1, duration: 1, delay: reduced ? 0 : 1.1 });
  })();
}
