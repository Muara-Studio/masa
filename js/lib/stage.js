// One three.js stage per section canvas: sized to its box, renders only while on screen.
import * as THREE from 'three';
import { gsap } from 'gsap';

export { THREE };

export function stage(canvas, { fov = 35, near = 0.1, far = 100, dpr = 1.75, alpha = true, margin = '15%' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const s = { THREE, renderer, scene, camera, w: 1, h: 1, visible: false, frame: null, resize: null };

  const fit = () => {
    s.w = canvas.clientWidth || 1; s.h = canvas.clientHeight || 1;
    renderer.setSize(s.w, s.h, false);
    camera.aspect = s.w / s.h; camera.updateProjectionMatrix();
    s.resize?.(s);
  };
  new ResizeObserver(fit).observe(canvas);
  fit();
  new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; }, { rootMargin: margin }).observe(canvas);

  let t = 0;
  gsap.ticker.add((_, dms) => {
    if (!s.visible) return;
    const dt = Math.min(dms / 1000, 1 / 20);
    t += dt;
    s.frame?.(t, dt);
    renderer.render(scene, camera);
  });
  return s;
}

// call inside a section's try block; on failure the section shows its static fallback
export function hasGL() {
  if (document.documentElement.classList.contains('no-gl')) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
