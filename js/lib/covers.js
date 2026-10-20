// Product covers drawn in code (batik kawung and parang, tenun ikat, megamendung clouds). Pure: returns SVG strings, no DOM.
const f = (n) => +n.toFixed(1);
const P = (pts) => pts.map((p) => p.map(f).join(' ')).join('L');

// mulberry32: small seeded PRNG so a cover looks the same on every load
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// kawung: four ovals per tile pointing at the corners, so rosettes form at tile centres and corners alike
function kawung(id, { ground, petal, line, dot }, k) {
  const ovals = [[12.5, 12.5, 45], [37.5, 12.5, -45], [12.5, 37.5, -45], [37.5, 37.5, 45]].map(([x, y, r]) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="15.5" ry="8.2" fill="${petal}" stroke="${line}" stroke-width="1.1"/><ellipse rx="9" ry="3.3" fill="none" stroke="${line}" stroke-width=".7"/><circle r="1.3" fill="${line}"/></g>`).join('');
  const dots = [[25, 25], [0, 0], [50, 0], [0, 50], [50, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${dot}"/>`).join('');
  const gems = [[25, 0], [25, 50], [0, 25], [50, 25]].map(([x, y]) => `M${x} ${y - 3.2}L${x + 3.2} ${y}L${x} ${y + 3.2}L${x - 3.2} ${y}Z`).join('');
  return `<pattern id="${id}" width="50" height="50" patternUnits="userSpaceOnUse" patternTransform="scale(${k})"><rect width="50" height="50" fill="${ground}"/>${ovals}${dots}<path d="${gems}" fill="${dot}"/></pattern>`;
}

// parang: a row of leaning S-blades over a dotted band, the whole tile turned 45°
function parang(id, { ground, blade, line, band, gem }, k) {
  const s = 'M3 21C3 12 21 13 21 3';
  return `<pattern id="${id}" width="24" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(-45) scale(${k})"><rect width="24" height="32" fill="${ground}"/><rect y="24" width="24" height="8" fill="${band}"/><path d="M0 24.5H24M0 31.5H24" stroke="${blade}" stroke-width=".8"/><path d="${s}" fill="none" stroke="${blade}" stroke-width="5.6" stroke-linecap="round"/><path d="${s}" fill="none" stroke="${line}" stroke-width=".9" stroke-linecap="round"/><path d="M6 25.8L8.2 28L6 30.2L3.8 28ZM18 25.8L20.2 28L18 30.2L15.8 28Z" fill="${gem}"/></pattern>`;
}

// tenun bands: random widths for the top half, mirrored like a woven sarong; heights always sum to `total`
export function bands(seed, total = 400) {
  const r = rng(seed), sizes = [4, 6, 10, 18, 30, 44], top = [];
  for (let y = 0; y < total / 2;) {
    const h = Math.min(sizes[Math.floor(r() * sizes.length)], total / 2 - y);
    top.push({ y, h, c: Math.floor(r() * 5), ikat: h >= 30 && r() < 0.8 });
    y += h;
  }
  return top.concat(top.map((b) => ({ ...b, y: total - b.y - b.h })).reverse());
}

function tenun(id, pal, seed, k) {
  const body = bands(seed).map(({ y, h, c, ikat }) => {
    let s = `<rect y="${y}" width="400" height="${h}" fill="${pal[c]}"/>`;
    if (!ikat) return s;
    const d = h * 0.38, step = h * 1.3, cy = y + h / 2, m = pal[(c + 2) % pal.length];
    let ghost = '', solid = '', hole = '';
    for (let x = step / 2; x < 400 + step; x += step) {
      const dia = (dx, dd) => `M${P([[x + dx - dd * 1.3, cy], [x + dx, cy - dd], [x + dx + dd * 1.3, cy], [x + dx, cy + dd]])}Z`;
      ghost += dia(2.6, d); solid += dia(0, d); hole += dia(0, d * 0.4);
    }
    // ikat threads are dyed before weaving, so every lozenge bleeds a little sideways
    return s + `<path d="${ghost}" fill="${m}" opacity=".4"/><path d="${solid}" fill="${m}"/><path d="${hole}" fill="${pal[c]}"/>`;
  }).join('');
  const weave = `<pattern id="${id}w" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 .5H3" stroke="#fff" stroke-opacity=".08"/><path d="M.5 0V3" stroke="#000" stroke-opacity=".14"/></pattern>`;
  return `${weave}<pattern id="${id}" width="400" height="400" patternUnits="userSpaceOnUse" patternTransform="scale(${k})">${body}<rect width="400" height="400" fill="url(#${id}w)"/></pattern>`;
}

// one megamendung contour: lumpy top, flatter base; inner contours (smaller k) sink toward the base
export function cloud(R, k, phase, n = 32) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, sy = Math.sin(a), r = R * k * (1 + 0.13 * Math.cos(7 * a + phase) * (sy < 0 ? 1 : 0.25));
    p.push([Math.cos(a) * r * 1.45, (1 - k) * R * 0.34 + sy * r * (sy > 0 ? 0.6 : 0.95)]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2].map(f).join(' ');
  let d = `M${mid(p[n - 1], p[0])}`;
  for (let i = 0; i < n; i++) d += `Q${p[i].map(f).join(' ')} ${mid(p[i], p[(i + 1) % n])}`;
  return d + 'Z';
}

const TONES = ['#1b2a4e', '#2c4677', '#4b6ea3', '#7d9dcb', '#b9cde6'];
// three cloud shapes defined once and placed with <use>, so a field of clouds stays a few KB
function cloudDefs(id, line) {
  return [0, 1.3, 2.6].map((ph, v) => {
    const paths = TONES.map((t, j) => cloud(40, 1 - j / TONES.length, ph));
    const solid = paths.map((d, j) => `<path d="${d}" fill="${TONES[j]}"${line ? ` stroke="${line}" stroke-width="1.3"` : ''}/>`).join('');
    const drawn = line ? paths.map((d) => `<path d="${d}" fill="#fbfaf7" stroke="${line}" stroke-width="1.3"/>`).join('') : '';
    return `<g id="${id}${v}">${solid}</g>${line ? `<g id="${id}${v}l">${drawn}</g>` : ''}`;
  }).join('');
}
function cloudField(id, seed, [x0, y0, w, h], line) {
  const r = rng(seed), out = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++)
    out.push([x0 + (col + (row % 2) * 0.5) * (w / 2.2) + (r() - 0.5) * 20, y0 + 14 + row * (h / 4.4) + (r() - 0.5) * 14, 0.55 + r() * 0.3, r()]);
  return out.sort((a, b) => a[1] - b[1]).map(([x, y, s, q], i) => {
    // colouring book: most clouds still blank line art, a few already coloured in
    const ref = `${id}${i % 3}${line && q > 0.3 ? 'l' : ''}`;
    return `<use href="#${ref}" transform="translate(${f(x)} ${f(y)}) scale(${q > 0.5 ? '' : '-'}${f(s)} ${f(s)})"/>`;
  }).join('');
}

const blur = (id, sd = 9) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const lin = (id, stops, v = false) => `<linearGradient id="${id}"${v ? ' x2="0" y2="1"' : ''}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const shade = (u, x, y, w, h, rx = 6, a = 0.32) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#2a1a10" opacity="${a}" filter="url(#${u}s)" transform="translate(7 11)"/>`;

const SCENES = {
  journal: (u) => [['#efe6e6', '#e3d6d6'],
    kawung(`${u}k`, { ground: '#3b1d32', petal: '#a45a83', line: '#f1e3d6', dot: '#d7a24a' }, 0.78) + lin(`${u}g`, [[0, '#fff', 0.16], [0.6, '#fff', 0]]),
    `<g transform="rotate(-6 240 200)">${shade(u, 162, 60, 168, 236)}<rect x="170" y="66" width="166" height="234" rx="6" fill="#f3ede4"/><path d="M333 74V292" stroke="#d8cfc2"/><rect x="162" y="60" width="168" height="236" rx="6" fill="url(#${u}k)"/><rect x="162" y="60" width="168" height="236" rx="6" fill="url(#${u}g)"/><rect x="162" y="60" width="18" height="236" rx="6" fill="#000" opacity=".24"/><rect x="204" y="196" width="92" height="46" rx="2" fill="#f3ede4"/><rect x="208" y="200" width="84" height="38" rx="1" fill="none" stroke="#3b1d32" stroke-width=".8"/><rect x="222" y="213" width="56" height="3" fill="#3b1d32"/><rect x="232" y="223" width="36" height="2" fill="#3b1d32" opacity=".55"/><rect x="306" y="60" width="7" height="236" fill="#1f0f1a"/></g>`],

  postcards: (u) => {
    const cards = [[194, 218, -11, 3], [244, 196, -2, 7], [294, 214, 9, 2]];
    return [['#ece7dd', '#ded6c8'],
      cards.map(([, , , s], i) => tenun(`${u}t${i}`, ['#8e2f22', '#1f2b45', '#c48a3a', '#ecdfc6', '#1a1716'], s, 0.36)).join(''),
      cards.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})">${shade(u, -100, -66, 200, 132, 3, 0.26)}<rect x="-100" y="-66" width="200" height="132" rx="3" fill="#f6f1e8"/><rect x="-92" y="-58" width="184" height="116" fill="url(#${u}t${i})"/></g>`).join('')];
  },

  colouring: (u) => [['#e7eaee', '#d8dde3'],
    cloudDefs(`${u}m`, '#1e1e1e') + `<clipPath id="${u}c"><rect x="152" y="54" width="176" height="244" rx="4"/></clipPath>`,
    `<g transform="rotate(4 240 200)">${shade(u, 150, 52, 180, 248, 4)}<rect x="156" y="58" width="178" height="246" rx="4" fill="#ece8e0"/><rect x="150" y="52" width="180" height="248" rx="4" fill="#fbfaf7"/><g clip-path="url(#${u}c)">${cloudField(`${u}m`, 5, [150, 52, 180, 248], '#1e1e1e')}</g><rect x="186" y="78" width="108" height="30" fill="#fbfaf7" stroke="#1e1e1e" stroke-width=".9"/><rect x="204" y="89" width="72" height="3" fill="#1e1e1e"/><rect x="218" y="97" width="44" height="2" fill="#1e1e1e" opacity=".55"/><rect x="150" y="52" width="180" height="248" rx="4" fill="none" stroke="#cfc8bc"/></g>` +
    `<g transform="translate(318 330) rotate(-24)">${shade(u, -84, -6, 172, 12, 6, 0.3)}<rect x="-84" y="-6" width="150" height="12" rx="1.5" fill="#2c4677"/><rect x="-84" y="-6" width="150" height="4" fill="#fff" opacity=".14"/><path d="M66 -6L90 0L66 6Z" fill="#e7c79c"/><path d="M83.5 -1.6L90 0L83.5 1.6Z" fill="#1b2a4e"/></g>`],

  candle: (u) => {
    const clove = ([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(1.45)"><path d="M0 0H18" stroke="#4a2c1a" stroke-width="3.2" stroke-linecap="round"/><circle cx="-2" r="4.2" fill="#3a2214"/><circle cx="-5" cy="-3" r="2" fill="#5a3620"/><circle cx="-5" cy="3" r="2" fill="#5a3620"/></g>`;
    const body = 'M170 150V302Q170 322 190 322H290Q310 322 310 302V150Z';
    return [['#eee4d8', '#dfd2c2'],
      parang(`${u}p`, { ground: '#e9dcc3', blade: '#4a2c1a', line: '#d9b07a', band: '#b98a5a', gem: '#1d2640' }, 1) +
      lin(`${u}y`, [[0, '#000', 0.42], [0.32, '#fff', 0.12], [0.55, '#fff', 0], [1, '#000', 0.46]]) +
      `<radialGradient id="${u}f" cy=".62" r=".6"><stop offset="0" stop-color="#fffbe8"/><stop offset=".45" stop-color="#ffd27a"/><stop offset="1" stop-color="#e8833a" stop-opacity="0"/></radialGradient><radialGradient id="${u}o"><stop offset="0" stop-color="#ffc56b" stop-opacity=".45"/><stop offset="1" stop-color="#ffc56b" stop-opacity="0"/></radialGradient>`,
      `<ellipse cx="244" cy="326" rx="86" ry="12" fill="#2a1a10" opacity=".34" filter="url(#${u}s)"/><path d="${body}" fill="#2b2420"/><rect x="170" y="206" width="140" height="72" fill="url(#${u}p)"/><path d="${body}" fill="url(#${u}y)"/><ellipse cx="240" cy="150" rx="70" ry="12" fill="#3a312b"/><ellipse cx="240" cy="151" rx="62" ry="9" fill="#efe3cc"/><circle cx="240" cy="122" r="40" fill="url(#${u}o)"/><path d="M240 141V131" stroke="#1a1716" stroke-width="2" stroke-linecap="round"/><path d="M240 102C246 113 250 121 247 128C245 133 235 133 233 128C230 121 234 113 240 102Z" fill="url(#${u}f)"/><path d="M241 98C235 86 249 79 242 66S236 48 247 34" fill="none" stroke="#6b625a" stroke-opacity=".35" stroke-width="1.2"/>${[[112, 336, -20], [134, 349, 14], [362, 342, 200]].map(clove).join('')}`];
  },
};
export const KINDS = Object.keys(SCENES);

// `uid` keeps gradient and pattern ids unique when several covers share a page
export function cover(kind, uid = kind) {
  const [[top, bottom], defs, body] = SCENES[kind](uid);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 0 440 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>${lin(`${uid}bg`, [[0, top], [1, bottom]], true)}${blur(`${uid}s`)}${defs}</defs><rect width="480" height="400" fill="url(#${uid}bg)"/>${body}</svg>`;
}
