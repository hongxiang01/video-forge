// 摘自 lemo-opuscar cel-anime-80s demo/rider.js（MIT）：两端圆头的肢体外形
export function limb(a, b, w1, w2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, px = -uy, py = ux;
  const r1 = w1 / 2, r2 = w2 / 2, pts = [];
  const cap = (c, r, s) => { const out = []; for (let k = 0; k <= 4; k++) { const an = -Math.PI / 2 + k * Math.PI / 4; const ca = Math.cos(an), sa = Math.sin(an); out.push([c[0] + (ux * ca * s + px * sa * s) * r, c[1] + (uy * ca * s + py * sa * s) * r]); } return out; };
  return cap(b, r2, 1).concat(cap(a, r1, -1));
}
