// 骨骼贴图人偶：身子 = 豆包画的全身设定图（和表情头像同一套画法）切出来的部件（design/rig/，design/body/rig_build.py 生成），
// 四肢、尾巴是拉直的长条，按骨头弯回去（线性混合蒙皮：关节附近两根骨头按距离混合，弯成圆弧，不断开）；
// 躯干、骨盆、手、鞋是整块小图。WebGL2 画到一张离屏画布上，再整块贴回黑板（和头像一样不加颗粒遮罩）。
import { W, H, cam } from './main.js';

export const RIG = {};
const cv = new OffscreenCanvas(W, H);
const gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
const VS = `#version 300 es
in vec2 aP; in vec2 aT; uniform vec2 uR; out vec2 vT;
void main(){ vT = aT; gl_Position = vec4(aP.x / uR.x * 2. - 1., 1. - aP.y / uR.y * 2., 0., 1.); }`;
const FS = `#version 300 es
precision highp float; in vec2 vT; uniform sampler2D uS; uniform float uK, uD; out vec4 o;
void main(){ vec4 c = texture(uS, vT); o = vec4(c.rgb * uD, c.a) * uK; }`;
const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
const aP = gl.getAttribLocation(prog, 'aP'), aT = gl.getAttribLocation(prog, 'aT');
gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 16, 0);
gl.enableVertexAttribArray(aT); gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 16, 8);
const uR = gl.getUniformLocation(prog, 'uR'), uK = gl.getUniformLocation(prog, 'uK'), uD = gl.getUniformLocation(prog, 'uD');
gl.uniform1i(gl.getUniformLocation(prog, 'uS'), 0); gl.uniform2f(uR, W, H); gl.viewport(0, 0, W, H);
gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.SCISSOR_TEST);

const loadImg = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('load ' + f)); i.src = f; });
function texture(img) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
// k = 原图 1 像素 = 多少世界单位（按髋高对齐旧骨架，地面和脚的编排不变）
const HIP = { kid: 146, adult: 318 };
export async function loadRig(who) {
  const J = await (await fetch(`design/rig/${who}_rig.json`)).json();
  const k = HIP[who] / (J.ground - J.pts.hip[1]);
  for (const p of Object.values(J.parts)) { const img = await loadImg(`design/rig/${p.img}`); p.tex = texture(img); p.w = img.width; p.h = img.height; }
  RIG[who] = { ...J, k, ox: (J.pts.anN[0] + J.pts.anF[0]) / 2 };
  return RIG[who];
}

// ---------- 一批部件：清离屏画布 → 画三角形 → 贴回黑板（只贴用到的那块矩形）
let bb = null;
export function glBegin() { bb = [1e9, 1e9, -1e9, -1e9]; gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
export function glEnd(board) {
  if (!bb || bb[2] <= bb[0] || globalThis.__noGL) return;
  const x0 = Math.max(0, Math.floor(bb[0]) - 2), y0 = Math.max(0, Math.floor(bb[1]) - 2), x1 = Math.min(W, Math.ceil(bb[2]) + 2), y1 = Math.min(H, Math.ceil(bb[3]) + 2);
  if (x1 > x0 && y1 > y0) { board.save(); board.setTransform(1, 0, 0, 1, 0, 0); board.globalAlpha = 1; board.drawImage(cv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); board.restore(); }
  bb = null;
}
function draw(part, v, ink, dim) {
  for (let i = 0; i < v.length; i += 4) { const x = v[i], y = v[i + 1]; if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, part.tex); gl.uniform1f(uK, ink); gl.uniform1f(uD, dim);
  gl.bufferData(gl.ARRAY_BUFFER, v, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, v.length / 4);
}
const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// 整块小图：T 把原图坐标变到角色本地坐标，M 把本地坐标变到屏幕
export function quad(part, T, M, ink = 1, dim = 1) {
  const [x0, y0] = part.off, w = part.w, h = part.h, c = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]].map((p) => M(T(p)));
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]], v = new Float32Array(24); let o = 0;
  for (const i of [0, 1, 2, 0, 2, 3]) { v[o++] = c[i][0]; v[o++] = c[i][1]; v[o++] = uv[i][0]; v[o++] = uv[i][1]; }
  draw(part, v, ink, dim);
}
// 长条：joints = 摆好的关节（本地坐标，和 part.u 里的关节一一对应），k = 原图像素 → 本地单位
export function chain(part, joints, k, M, ink = 1, dim = 1) {
  const us = part.u, hw = part.hw, nb = joints.length - 1, B = [];
  for (let b = 0; b < nb; b++) {
    const a = joints[b], c = joints[b + 1], dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
    B.push({ o: a, d: [dx / L, dy / L], n: [-dy / L, dx / L], s: L / Math.max(1e-6, us[b + 1] - us[b]) });
  }
  const rad = us.map((u, j) => (j === 0 || j === nb ? 0 : Math.min(hw * 0.85, 0.45 * (u - us[j - 1]), 0.45 * (us[j + 1] - u))));
  const pos = (u, v, b) => { const q = B[b], du = (u - us[b]) * q.s, dv = v * k; return [q.o[0] + q.d[0] * du + q.n[0] * dv, q.o[1] + q.d[1] * du + q.n[1] * dv]; };
  const at = (u, v) => {
    for (let j = 1; j < nb; j++) { const r = rad[j]; if (u > us[j] - r && u < us[j] + r) { const w = ss((u - (us[j] - r)) / (2 * r)), p = pos(u, v, j - 1), q = pos(u, v, j); return [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w]; } }
    let b = 0; while (b < nb - 1 && u >= us[b + 1]) b++; return pos(u, v, b);
  };
  const VS = [-hw, -hw / 2, 0, hw / 2, hw], cols = [];
  for (let u = 0; ; u += 4) { const uu = Math.min(u, part.w - 1); cols.push(VS.map((v) => [...M(at(uu, v)), (uu + 0.5) / part.w, (v + hw + 0.5) / part.h])); if (uu >= part.w - 1) break; }
  const v = new Float32Array((cols.length - 1) * (VS.length - 1) * 24); let o = 0;
  const put = (p) => { v[o++] = p[0]; v[o++] = p[1]; v[o++] = p[2]; v[o++] = p[3]; };
  for (let c = 0; c < cols.length - 1; c++) for (let r = 0; r < VS.length - 1; r++) { const a = cols[c][r], b = cols[c + 1][r], d = cols[c][r + 1], e = cols[c + 1][r + 1]; put(a); put(b); put(e); put(a); put(e); put(d); }
  draw(part, v, ink, dim);
}
// 本地 → 屏幕（角色位置、朝向、缩放 + 相机）
export function screenMap(P) {
  const s = P.scale ?? 1, f = s * (P.face ?? 1) * (P.sx ?? 1), cr = Math.cos(cam.r), sr = Math.sin(cam.r), px = P.x, py = P.y ?? 0;
  return ([x, y]) => { const X = cam.s * (px + f * x - cam.x), Y = cam.s * (py + s * y - cam.y); return [W / 2 + cr * X - sr * Y, H / 2 + sr * X + cr * Y]; };
}

// 整块小图按一条"脊柱"折线蒙皮（躯干弯腰用）：rest = 原图上的脊柱关节，posed = 摆好的关节（本地坐标）。
// 每个点按投影到脊柱轴上的位置 u 和横向偏移 v，在关节附近两根骨头之间平滑混合，弯成一道弧。
export class Skin {
  constructor(rest, posed, k) {
    const a = rest[0], z = rest[rest.length - 1], L = Math.hypot(z[0] - a[0], z[1] - a[1]);
    this.a = a; this.ax = [(z[0] - a[0]) / L, (z[1] - a[1]) / L]; this.k = k;
    this.us = rest.map((p) => (p[0] - a[0]) * this.ax[0] + (p[1] - a[1]) * this.ax[1]);
    const nb = rest.length - 1; this.nb = nb; this.B = [];
    for (let b = 0; b < nb; b++) { const o = posed[b], c = posed[b + 1], dx = c[0] - o[0], dy = c[1] - o[1], l = Math.hypot(dx, dy) || 1e-6; this.B.push({ o, d: [dx / l, dy / l], n: [-dy / l, dx / l], s: l / Math.max(1e-6, this.us[b + 1] - this.us[b]) }); }
    this.rad = this.us.map((u, j) => (j === 0 || j === nb ? 0 : Math.min(0.45 * (u - this.us[j - 1]), 0.45 * (this.us[j + 1] - u))));
  }
  pos(u, v, b) { const q = this.B[b], du = (u - this.us[b]) * q.s, dv = v * this.k; return [q.o[0] + q.d[0] * du + q.n[0] * dv, q.o[1] + q.d[1] * du + q.n[1] * dv]; }
  map(p) {
    const dx = p[0] - this.a[0], dy = p[1] - this.a[1], u = dx * this.ax[0] + dy * this.ax[1], v = -dx * this.ax[1] + dy * this.ax[0], us = this.us;
    for (let j = 1; j < this.nb; j++) { const r = this.rad[j]; if (u > us[j] - r && u < us[j] + r) { const w = ss((u - (us[j] - r)) / (2 * r)), P = this.pos(u, v, j - 1), Q = this.pos(u, v, j); return [P[0] + (Q[0] - P[0]) * w, P[1] + (Q[1] - P[1]) * w]; } }
    let b = 0; while (b < this.nb - 1 && u >= us[b + 1]) b++; return this.pos(u, v, b);
  }
  draw(part, M, ink = 1, dim = 1, nx = 10, ny = 16) {
    const [x0, y0] = part.off, w = part.w, h = part.h, G = [];
    for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) { const p = M(this.map([x0 + (w * i) / nx, y0 + (h * j) / ny])); row.push([p[0], p[1], i / nx, j / ny]); } G.push(row); }
    const v = new Float32Array(nx * ny * 24); let o = 0; const put = (p) => { v[o++] = p[0]; v[o++] = p[1]; v[o++] = p[2]; v[o++] = p[3]; };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = G[j][i], b = G[j][i + 1], c = G[j + 1][i], d = G[j + 1][i + 1]; put(a); put(b); put(d); put(a); put(d); put(c); }
    draw(part, v, ink, dim);
  }
}
