// Full-screen ink bloom: a domain-warped distance field from the click point and the screen edges, thresholded with a feathered, smoky rim.
import { stage } from './stage.js';

const FRAG = /* glsl */ `
uniform float uP, uAspect, uSeed;
uniform vec2 uClick;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.55); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y), q = p + uSeed;
  // warp twice so the blots grow fingers instead of circles
  vec2 w = p + .24 * (vec2(fbm(q * 2.2), fbm(q * 2.2 + 5.2)) - .5);
  w += .08 * (vec2(fbm(w * 7. + uSeed), fbm(w * 7. + 3.1)) - .5);
  float dc = length(w - vec2(uClick.x * uAspect, uClick.y));
  float de = (min(min(w.x, uAspect - w.x), min(w.y, 1. - w.y)) + .2) * 1.3 + .25 * (fbm(q * 4.3 + 1.7) - .5); // the edges start a beat after the click
  float d = min(dc, de);
  d += .32 * smoothstep(.52, .78, fbm(q * 3.1 + 9.)); // islands the ink reaches late: white left behind for a moment
  d += .09 * (fbm(w * 13. + 4.) - .5) - .1 * smoothstep(.62, .8, fbm(w * 9. + 6.)); // ragged fingers and droplets ahead of the front
  float r = uP * 1.02, edge = .006 + .04 * fbm(w * 16.);
  float a = 1. - smoothstep(r - edge, r + edge, d);
  a = max(a, (1. - smoothstep(r, r + .16, d)) * .3 * smoothstep(.35, .75, fbm(w * 6. + 2.))); // smoky fringe ahead of the front
  gl_FragColor = vec4(0., 0., 0., max(a, smoothstep(.88, 1., uP)));
}`;

export function createInk(canvas) {
  const s = stage(canvas, { dpr: 1, margin: '0px' });
  const { THREE } = s;
  const u = { uP: { value: 0 }, uAspect: { value: 1 }, uSeed: { value: Math.random() * 40 }, uClick: { value: new THREE.Vector2(0.5, 0.5) } };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u, fragmentShader: FRAG, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  }));
  quad.frustumCulled = false;
  s.scene.add(quad);
  s.resize = () => { u.uAspect.value = s.w / s.h; };
  s.renderer.compile(s.scene, s.camera); // no shader-compile hitch on the click
  return u;
}
