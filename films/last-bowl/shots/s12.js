// S12（33.0–36.0）中近景 · 斜俯 · 三渲二（TREATMENT §4 S12、§5 33.00–36.00；CONTINUITY S11→S12、S12→S13）。2D 版原样备份在 s12_2d.js。
// 师傅在近侧，右手从画面下沿拿湿布进来，四指扣布、掌根压着，顺一道弧把散开的面粉擦出一条干净的湿带
// → 34.5 手离开布、放平在擦净的木头上 → 34.917 起拇指顺木纹抹一下 → 多停一拍 → 35.75 起 3 张捏起布角、往下沿抬出画（布一起带走，A' 里台面上没有布）。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头（师傅这一侧）；台面 y = 0。台面（木板 + 面粉 + 碗底水印 + 擦出的湿弧带）画在一张 CanvasTexture 上，
// 弧带按布的位置逐帧擦出来；布（有厚度、有褶、左后拖一个布角）、手、前臂和袖子是三维的（lib3d 卡通材质 + 彩色描边），
// 一盏白色方向光（吊灯在左上），硬边投影落在布和台面上，不加环境光。弧和 A' 的湿布弧痕同向：起笔左近、收笔右远、拱向近侧。
// 机位斜俯 58°，33.0–34.5 跟着布往右移（ease-in-out），之后极慢地再漂一点；镜头每帧动，手和布按 12 fps 换张。
import * as THREE from 'three';
import { canvas, cel, path, ribbon, airbrush, mix, rgba, rng, hash, TAU } from '../lib/cel.js';
import { C, BG, LIGHT } from '../pal.js';
import { toon, sun, draw3d, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const WD = BG.warm, FL = C('flour'), D2R = Math.PI / 180;
const io = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const lerp = (a, b, m) => a + (b - a) * m;
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sst = (a, b, v) => { const u = cl((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const norm2 = (x, z) => { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; };
const rot = (th, x, z) => [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];   // 绕 Y 转 th（和手的 rotation.y 一致）
const segD = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, u = cl(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)); return Math.hypot(px - ax - vx * u, pz - az - vz * u); };

// —— 擦痕弧（台面，米：[x, z]）：起笔左近 → 收笔右远，拱向近侧（同 2D 版、同 A'）——
const ARC = { a: [-0.195, 0.037], c: [-0.013, 0.057], b: [0.195, -0.043], w: 0.088 };
const at = u => { const { a, c, b } = ARC; return [0, 1].map(i => (1 - u) ** 2 * a[i] + 2 * u * (1 - u) * c[i] + u * u * b[i]); };
const tan = u => { const { a, c, b } = ARC; return Math.atan2(2 * (1 - u) * (c[1] - a[1]) + 2 * u * (b[1] - c[1]), 2 * (1 - u) * (c[0] - a[0]) + 2 * u * (b[0] - c[0])); };
const RING = { c: (p => [p[0] + 0.003, p[1] - 0.006])(at(.42)), r: 0.036 };   // 碗底水印：在弧的路上，布擦过去就没了
const E0 = [0.27, 0.17, 0.50];   // 肘（世界）：前臂从右近侧低低地伸进来，一直伸出画框

// —— 台面贴图：KP px / 米；2D 版的像素尺寸 × k 搬过来（2D 版掌宽 200 px ≈ 9 cm）——
const KP = 2000, X0 = -0.85, Z0 = -0.62, PW = 1.7, PH = 1.0, TW = PW * KP, TH = PH * KP, k = KP / 2200;
const P = (x, z) => [(x - X0) * KP, (z - Z0) * KP];
function tablePlate() {
  const [c, g] = canvas(TW, TH), R = rng(1201);
  g.fillStyle = WD.wood; g.fillRect(0, 0, TW, TH);
  airbrush(g, ...P(-0.30, -0.30), 0.78 * KP, 0.52 * KP, WD.woodHalo, .95, .85);   // 吊灯在左上：光池在左远
  airbrush(g, ...P(0.62, 0.14), 0.45 * KP, 0.45 * KP, WD.woodDark, .7, .9);       // 右近落进暗部
  const bw = 240 * k;
  for (let y0 = -0.02 * KP; y0 < TH; y0 += bw) {
    for (let j = 0; j < 9; j++) {
      const yy = y0 + (20 + j * 24 + R() * 10) * k, ph = R() * TAU, amp = (4 + R() * 9) * k, wl = (500 + R() * 600) * k;
      g.strokeStyle = rgba(WD.grain, .35 + R() * .3); g.lineWidth = (1.4 + R() * 1.4) * k; g.beginPath();
      for (let x = 0; x <= TW + 24; x += 24) { const y = yy + amp * Math.sin(x / wl * TAU + ph); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    if (R() < .7) { const kx = R() * TW, ky = y0 + (60 + R() * 120) * k; g.strokeStyle = rgba(WD.grain, .6); g.lineWidth = 2 * k;
      for (let r = 0; r < 3; r++) { g.beginPath(); g.ellipse(kx, ky, (46 - r * 13) * k, (11 - r * 3) * k, 0, 0, TAU); g.stroke(); } }
    g.fillStyle = rgba(WD.woodDark, .55); g.fillRect(0, y0 + 236 * k, TW, 9 * k);
    g.fillStyle = WD.grain; g.fillRect(0, y0 + 234 * k, TW, 3 * k);
    g.fillStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .4), .5); g.fillRect(0, y0 + 231 * k, TW, 2 * k);
  }
  return c;
}
// 面粉层：沿弧一带撒开（横向近似高斯），薄粉层 + 几小堆 + 上千粒散粉；碗底那一圈是空的（碗刚在那儿立着）
const blob = (x, y, r, sd, sq = 1) => { const p = [], n = 9 + Math.floor(hash(sd) * 6); for (let i = 0; i < n; i++) { const a = i / n * TAU + hash(sd + i) * .5, q = .5 + .6 * hash(sd + i * 1.9); p.push([x + Math.cos(a) * r * q, y + Math.sin(a) * r * q * sq, hash(sd + i * 2.3) < .55 ? 1 : 0]); } return p; };
function flourPlate() {
  const [c, g] = canvas(TW, TH), R = rng(3303);
  const near = sp => { const u = -.12 + R() * 1.24, p = at(u), n = tan(u) + Math.PI / 2, d = (R() + R() + R() - 1.5) * sp; return P(p[0] + Math.cos(n) * d, p[1] + Math.sin(n) * d); };
  const [rx, ry] = P(...RING.c), rr = RING.r * KP, free = (x, y, r) => Math.hypot(x - rx, y - ry) > rr + 16 * k + r;
  const dust = (n, sp, r0, r1, a, sd) => {
    const [dc, dg] = canvas(TW, TH); dg.fillStyle = FL.f;
    for (let i = 0; i < n; i++) { const [x, y] = near(sp), r = (r0 + (r1 - r0) * R() ** 1.5) * k; if (free(x, y, r * .5)) dg.fill(path(blob(x, y, r, sd + i * 3.7, .55 + .4 * R()), true, .5)); }
    g.globalAlpha = a; g.drawImage(dc, 0, 0); g.globalAlpha = 1;
  };
  dust(900, 0.057, 7, 26, .48, 900);
  dust(420, 0.033, 5, 18, .5, 2900);
  for (let i = 0; i < 34; i++) { const [x, y] = near(0.036), r = (3 + 8 * R() ** 2) * k; if (free(x, y, r)) cel(g, blob(x, y, r, 50 + i * 7.3, .6 + .3 * R()), { f: FL.f, s: mix(FL.f, FL.s, .5), so: [-2, -2] }); }
  g.fillStyle = FL.f;
  for (let i = 0; i < 1700; i++) { const [x, y] = near(0.098), r = (.8 + 2.2 * R() ** 2) * k; if (free(x, y, 0)) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
  return c;
}
// 擦过的弧带（贴图 px）：0 … u 一段，起笔钝圆（布按下去），两边随布褶不规则起伏
function swept(u) {
  const sp = [], n = Math.max(2, Math.round(u * 48));
  for (let i = 0; i <= n; i++) sp.push(P(...at(u * i / n)));
  return path(ribbon(sp, s => ARC.w * KP * Math.min(1, Math.sqrt(s * u / .03 + .1)) * (.9 + .05 * Math.sin(s * u * 31) + .06 * hash(Math.round(s * u * 48)))), true, .5);
}
function berm(g, u) {   // 布推到两边的一道粉埂：一小撮一小撮（有断口），只画擦过的那段
  for (let i = 0; i < 70; i++) {
    const s = i / 70; if (s > u - .02) break;
    for (const sd of [-1, 1]) {
      if (hash(i * 3.1 + sd) < .3) continue;
      const p = at(s), n = tan(s) + Math.PI / 2, d = ARC.w * .5 * (.92 + .1 * hash(i + sd * 7)) + (4 + 6 * hash(i * 1.3 + sd)) / 2200, r = (3 + 6 * hash(i * 5.7 + sd)) * k;
      const [x, y] = P(p[0] + Math.cos(n) * d * sd, p[1] + Math.sin(n) * d * sd);
      cel(g, blob(x, y, r, 300 + i * 11 + sd, .7), { f: FL.f, s: mix(FL.f, FL.s, .5), so: [-2, -2] });
    }
  }
}
function ring(g) {   // 碗底水印：一圈淡淡的湿木头（一处断口：碗是斜着端起来的），朝灯一侧一道细水光
  const [x, y] = P(...RING.c), r = RING.r * KP;
  g.lineCap = 'round';
  g.strokeStyle = rgba(WD.woodDark, .3); g.lineWidth = 10 * k; g.beginPath(); g.arc(x, y, r, .5, .5 + TAU * .9); g.stroke();
  g.strokeStyle = rgba(WD.woodDark, .14); g.lineWidth = 6 * k; g.beginPath(); g.arc(x + 3 * k, y + 2 * k, r - 11 * k, 0, TAU); g.stroke();
  g.strokeStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .55), .55); g.lineWidth = 2.5 * k; g.beginPath(); g.arc(x, y, r - 4 * k, 3.5, 4.9); g.stroke();
}
// 这一张的台面：木板 → （扣掉弧带）水印 + 面粉 → 湿痕 + 水光 + 粉埂 → 拇指抹过的亮痕
function surface(T, u, mark) {
  const g = T.g;
  g.drawImage(T.table, 0, 0);
  const sw = u > 0 ? swept(u) : null;
  g.save();
  if (sw) { const hole = new Path2D(); hole.rect(-10, -10, TW + 20, TH + 20); hole.addPath(sw); g.clip(hole, 'evenodd'); }
  ring(g); g.drawImage(T.flour, 0, 0); g.restore();
  if (sw) {
    g.fillStyle = rgba(WD.woodDark, .2); g.fill(sw);   // 湿痕：深一档的木头
    const glint = (off, t0, t1, w) => { if (u <= t0) return; const sp = []; for (let i = 0; i <= 20; i++) { const s = t0 + (Math.min(t1, u) - t0) * i / 20, p = at(s), n = tan(s) + Math.PI / 2; sp.push(P(p[0] + Math.cos(n) * off * ARC.w, p[1] + Math.sin(n) * off * ARC.w)); } g.fill(path(ribbon(sp, s => w * k * Math.sqrt(Math.sin(Math.PI * s))))); };
    g.fillStyle = rgba(mix(LIGHT.warm, WD.woodHalo, .3), .8); glint(-.22, .1, .3, 4); glint(-.3, .38, .55, 3.5); glint(.12, .62, .8, 4);
    berm(g, u);
  }
  if (mark) {
    const [a, b] = mark.map(p => P(...p));
    g.strokeStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .55), .75); g.lineWidth = 7 * k; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
  }
  T.tex.needsUpdate = true;
}

// —— 湿布：对折后的一块（布坐标，米，跟手一起转：x 往小指一侧为正，z 往手腕一侧为正），左后（拇指一侧、靠腕）拖出一个布角 ——
// 顶面是 (s, t) 网格上的高度场；底面 = 顶面沿法线往下 2.5 mm，四边缝起来 → 闭合的薄片（背面外扩的描边才描得出来）
const CN = 72, CC = [0.003, -0.03];   // CC = 布心（布坐标）
function restXZ(s, t) {
  const wc = ((1 - s) * t) ** 2.2;   // 拖角的权重（左后角 = 1）
  const x = lerp(-0.068, 0.074, s) - 0.032 * wc + 0.004 * Math.sin(t * 9 + 1) * (1 - s) ** 3 + 0.003 * Math.sin(t * 7 + 2) * s ** 3;
  const z = lerp(-0.112, 0.052, t) + 0.022 * wc + 0.004 * Math.sin(s * 8 + .5) * (1 - t) ** 3 + 0.003 * Math.sin(s * 11) * t ** 3;
  return [x, z, wc];
}
const COR = restXZ(0, 1);
// 布上的皱：[起 x, 起 z, 止 x, 止 z, 高, 半宽]（布坐标，米）——拇指一侧一道长斜折、掌根后面两道横皱、前沿和右沿几道短褶
const WR = [[-0.058, 0.04, -0.036, -0.06, 0.006, 0.006], [-0.04, 0.045, 0.03, 0.03, 0.004, 0.005], [-0.02, 0.05, 0.05, 0.048, 0.003, 0.004],
  [0.035, -0.105, 0.05, -0.07, 0.004, 0.004], [-0.03, -0.11, -0.045, -0.085, 0.0035, 0.004], [0.06, -0.02, 0.072, 0.02, 0.004, 0.004],
  [-0.064, -0.02, -0.05, 0.0, 0.003, 0.004], [-0.085, 0.07, -0.06, 0.05, 0.005, 0.005]];
// 摊在台面上（被手按着 / 松开）：c = { O, th, y, grip, wv, G（捏起时指尖在布坐标里的位置） }
function clothTop(c) {
  const rz = -0.074;
  return (s, t) => {
    let [x, z, wc] = restXZ(s, t), y = 0.0032;
    y += 0.0025 * (1 - sst(0, .1, Math.min(s, 1 - s, t, 1 - t)));                                // 湿布边略翘
    if (c.grip && c.tips) {                                                                         // 四指扣进布里：指尖前面拱起一道连着的布褶，再往前拉出几道放射的褶
      const T = [...c.tips].sort((p, q) => p[0] - q[0]), x0 = T[0][0], x1 = T[3][0];
      let zr = T[0][1]; for (let m = 0; m < 3; m++) if (x > T[m][0]) zr = lerp(T[m][1], T[m + 1][1], cl((x - T[m][0]) / (T[m + 1][0] - T[m][0])));
      y += c.grip * 0.009 * Math.exp(-(((z - zr + 0.008) / 0.009) ** 2)) * sst(x0 - 0.014, x0, x) * (1 - sst(x1, x1 + 0.014, x));
      for (const [tx, tz] of T) y += c.grip * 0.005 * Math.exp(-((segD(x, z, tx, tz - 0.012, tx * 1.3, -0.118) / 0.004) ** 2)) * sst(tz - 0.01, tz - 0.025, z);
    }
    for (const [ax, az, bx, bz, hh, ww] of WR) y += hh * 1.5 * Math.exp(-((segD(x, z, ax, az, bx, bz) / ww) ** 2));   // 湿布本身的皱：几道长短不一的褶
    y += 0.0035 * Math.exp(-((segD(x, z, 0.058, -0.1, 0.064, 0.045) / 0.005) ** 2));               // 小指一侧：对折的那条边，两层叠着
    y += (0.013 + 0.003 * Math.sin((c.wv || 0) * 1.9)) * wc ** 1.4;                                // 拖角翘起、卷一点，12 fps 轻轻摆
    if (c.G) { const m = wc ** .8; x += (c.G[0] - COR[0]) * m; z += (c.G[1] - COR[1]) * m; y += Math.max(0, c.G[2] - y) * m; }   // 布角被捏起来：角附近整块挪到指尖、往上提成一个小帐篷（不往一点收，免得拉成丝）
    const [wx, wz] = rot(c.th, x, z);
    return [c.O[0] + wx, y + (c.y || 0), c.O[1] + wz];
  };
}
// 捏着布角提起来：布从指尖垂下，垂到台面的那段还拖在台面上（朝布原来的位置）；横向收拢、带几道竖褶
function drapeTop(c, G) {
  const ax = norm2(CC[0] - COR[0], CC[1] - COR[1]), ctr = rot(c.th, ...CC), tr = norm2(c.O[0] + ctr[0] - G[0], c.O[1] + ctr[1] - G[2]), pp = [-tr[1], tr[0]], hY = G[1] - 0.004;
  return (s, t) => {
    const [x, z] = restXZ(s, t), rx = x - COR[0], rz = z - COR[1], al = rx * ax[0] + rz * ax[1], ac = -rx * ax[1] + rz * ax[0];
    const hang = Math.min(al, hY), lie = Math.max(0, al - hY), wob = 0.009 * Math.sin(al * 70 + ac * 30) * sst(0, .03, al);
    const w = ac * .5 + wob, f = 0.006 * Math.sin(ac * 60 + al * 20);
    return [G[0] + pp[0] * w + tr[0] * (lie + f), Math.max(0.0035, G[1] - hang), G[2] + pp[1] * w + tr[1] * (lie + f)];
  };
}
function clothGeo(fn) {
  const n = CN + 1, top = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) top.push(fn(i / CN, j / CN));
  const pos = new Float32Array(n * n * 6), id = [];
  const up = (i, j) => {   // 顶面朝上的法线 = ∂t × ∂s
    const A = top[j * n + Math.min(CN, i + 1)], B = top[j * n + Math.max(0, i - 1)], Cc = top[Math.min(CN, j + 1) * n + i], Dd = top[Math.max(0, j - 1) * n + i];
    const u = [0, 1, 2].map(q => A[q] - B[q]), v = [0, 1, 2].map(q => Cc[q] - Dd[q]);
    const m = [v[1] * u[2] - v[2] * u[1], v[2] * u[0] - v[0] * u[2], v[0] * u[1] - v[1] * u[0]], L = Math.hypot(...m) || 1;
    return m.map(q => q / L);
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i, p = top[q], nn = up(i, j);
    pos.set(p, q * 3); pos.set([p[0] - nn[0] * 0.0025, p[1] - nn[1] * 0.0025, p[2] - nn[2] * 0.0025], (n * n + q) * 3);
  }
  const T = (i, j) => j * n + i, Bt = (i, j) => n * n + j * n + i;
  for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
    id.push(T(i, j), T(i, j + 1), T(i + 1, j), T(i + 1, j), T(i, j + 1), T(i + 1, j + 1));
    id.push(Bt(i, j), Bt(i + 1, j), Bt(i, j + 1), Bt(i + 1, j), Bt(i + 1, j + 1), Bt(i, j + 1));
  }
  const loop = [];
  for (let i = 0; i < CN; i++) loop.push([i, 0]);
  for (let j = 0; j < CN; j++) loop.push([CN, j]);
  for (let i = CN; i > 0; i--) loop.push([i, CN]);
  for (let j = CN; j > 0; j--) loop.push([0, j]);
  loop.forEach((p, m) => { const q = loop[(m + 1) % loop.length], a = T(...p), b = T(...q), c = Bt(...p), d = Bt(...q); id.push(a, b, c, c, b, d); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(id); geo.computeVertexNormals();
  return geo;
}

// —— 手型（度）：[张开（正 = 往拇指那边）, 掌指关节弯, 中节弯, 末节弯]；拇指 [指根张开, 指根弯, 第二节弯, 末节弯] ——
// 扣布擦：四指往下扣进布里（食指最直、小指最蜷），拇指顺着布的左沿压着；放平：四指松开、略张、指尖轻贴木头；捏布角：四指收拢、拇指压过来
const POSE = {
  scrub: { thumb: [-20, 4, 6, 4], index: [1, 14, 22, 12], middle: [0, 16, 24, 13], ring: [-1, 18, 25, 13], pinky: [-4, 20, 26, 13] },
  flat: { thumb: [-14, 14, 8, 6], index: [-2, 6, 10, 6], middle: [0, 5, 10, 6], ring: [1, 7, 11, 6], pinky: [-2, 9, 12, 7] },
  grab: { thumb: [-4, 36, 26, 18], index: [1, 44, 62, 34], middle: [0, 48, 66, 36], ring: [-2, 52, 70, 36], pinky: [-5, 56, 72, 36] },
};
// 拇指张开角负 = 往外（左）打开（试过 -40…60：负值才露在掌外）。顺木纹往外抹：4 张，指根压着，末节受力往后翘
const STROKE = [[-14, 14, 8, 6], [-22, 16, 8, 2], [-30, 18, 8, -2], [-36, 20, 8, -4]];
const mixP = (A, B, m) => Object.fromEntries(Object.keys(A).map(f => [f, A[f].map((v, j) => lerp(v, B[f][j], m))]));
const yawAt = (x, z) => { const [dx, dz] = norm2(x - E0[0], z - E0[2]); return Math.atan2(-dx, -dz) - 10 * D2R; };   // 四指顺着前臂往前，腕往小指一侧折 10°
function originAt(u) { const p = at(u), o = rot(yawAt(...p), ...CC), O = [p[0] - o[0], p[1] - o[1]]; return { O, th: yawAt(...O) }; }

// 这一张（tc = 按 12 fps 取整的镜头内秒数）：手（掌心压点 + 朝向 + 俯仰）、手型、布、擦到哪（u）、拇指抹到第几张（ti）
function act(tc) {
  const n = Math.round(tc * 12), end = originAt(1), F = (o => [end.O[0] + o[0], end.O[1] + o[1]])(rot(end.th, -0.07, 0.19));
  if (n < 3) {   // 33.0–33.25：拿着布从下沿进来，3 张落到起笔处
    const { O } = originAt(0), dir = norm2(E0[0] - O[0], E0[2] - O[1]), d = [0.26, 0.12, 0.035][n], X = [O[0] + dir[0] * d, O[1] + dir[1] * d], y = [0.11, 0.05, 0.012][n];
    return { hand: [X[0], y + 0.0065, X[1]], th: yawAt(...X), pitch: 6, pose: POSE.scrub, cloth: { O: X, th: yawAt(...X), y, grip: 1, wv: n }, u: 0 };
  }
  if (n < 18) { const u = io((tc - .25) / 1.25), { O, th } = originAt(u); return { hand: [O[0], 0.0065, O[1]], th, pitch: 3, pose: POSE.scrub, cloth: { O, th, grip: 1, wv: n }, u }; }   // 33.25–34.5 顺弧擦
  const rest = { O: end.O, th: end.th };
  if (n < 21) {   // 34.5–34.75：手离开布，往回放平在擦净的木头上（3 张）
    const m = [.4, .78, 1][n - 18], X = [lerp(end.O[0], F[0], m), lerp(end.O[1], F[1], m)];
    return { hand: [X[0], [0.016, 0.012, 0][n - 18] + lerp(0.0065, 0.0015, m), X[1]], th: yawAt(...X), pitch: lerp(3, 0, m), pose: mixP(POSE.scrub, POSE.flat, m), cloth: { ...rest, grip: 1 - m }, u: 1 };
  }
  if (n < 33) { const ti = n < 23 ? 0 : Math.min(3, n - 22); return { hand: [F[0], 0.0015, F[1]], th: yawAt(...F), pitch: 0, pose: { ...POSE.flat, thumb: STROKE[ti] }, cloth: rest, u: 1, ti }; }   // 掌平放；拇指顺木纹抹，停一拍
  const j = Math.min(2, n - 33), dir = norm2(E0[0] - F[0], E0[2] - F[1]), d = [-0.03, 0.08, 0.17][j], X = [F[0] + dir[0] * d, F[1] + dir[1] * d];   // 35.75 起 3 张：捏起布角、往下沿抬出画（最后一张手和布还压在下沿上，切在动作上）
  return { hand: [X[0], [0.012, 0.055, 0.10][j], X[1]], th: yawAt(...X), pitch: [8, 16, 20][j], pose: POSE.grab, cloth: { ...rest, pick: j + 1 }, u: 1, ti: 3 };
}

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 20);
  const [dc, dg] = canvas(TW, TH), T = { table: tablePlate(), flour: flourPlate(), g: dg, tex: new THREE.CanvasTexture(dc) };
  T.tex.anisotropy = renderer().r.capabilities.getMaxAnisotropy();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: T.tex }));
  board.rotation.x = -Math.PI / 2; board.position.set(X0 + PW / 2, 0, Z0 + PH / 2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.ShadowMaterial({ color: new THREE.Color(WD.woodDark), opacity: .55 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, 0.0004, board.position.z); shade.receiveShadow = true;
  for (const m of [board, shade]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; }
  const cloth = new THREE.Mesh(new THREE.BufferGeometry(), toon(C('cloth'), { t: .3, hi: .96 })); cloth.castShadow = cloth.receiveShadow = true;
  const hand = makeHand('R');
  scene.add(board, shade, cloth, hand.root, hand.arm);
  sun(scene, [-0.55, 1.0, -0.6], 0.8, [0, 0, 0.03]);
  return (S = { scene, cam, T, cloth, hand });
}

export function draw(g, e, lt, A, t) {
  const s = setup(), tc = Math.floor(lt * 12 + 1e-6) / 12, Q = act(tc), H = s.hand, v = new THREE.Vector3();
  const place = pose => { H.pose(pose); H.root.position.set(...Q.hand); H.root.rotation.set(Q.pitch * D2R, Q.th, 0, 'YXZ'); H.root.updateMatrixWorld(true); };
  const tipW = () => { const a = H.B['index-finger-tip'].getWorldPosition(v).clone(), b = H.B['thumb-tip'].getWorldPosition(v).clone(); return a.lerp(b, .35); };
  let mark = null;
  if (Q.ti >= 2 && !Q.cloth.pick) {   // 拇指抹过的亮痕：从第 1 张的拇指尖到这一张的拇指尖
    place({ ...Q.pose, thumb: STROKE[1] }); const a = H.B['thumb-tip'].getWorldPosition(v).clone();
    place(Q.pose); const b = H.B['thumb-tip'].getWorldPosition(v).clone();
    mark = [[a.x, a.z], [b.x, a.z]];   // 顺木纹（横走）
  }
  place(Q.pose);
  if (Q.cloth.pick === 1) {   // 捏布角那一张：先摆好手，量指尖离布角差多少，整只手挪过去 → 指尖正好落在布角上（布不会被拉成一根丝）
    const G = tipW(), cw = rot(Q.cloth.th, COR[0], COR[1]);
    Q.hand = [Q.hand[0] + Q.cloth.O[0] + cw[0] - G.x, Q.hand[1], Q.hand[2] + Q.cloth.O[1] + cw[1] - G.z]; place(Q.pose);
  }
  if (Q.cloth.grip) Q.cloth.tips = ['index', 'middle', 'ring', 'pinky'].map(f => { const p = H.B[`${f}-finger-tip`].getWorldPosition(v); return rot(-Q.cloth.th, p.x - Q.cloth.O[0], p.z - Q.cloth.O[1]); });
  const w = H.root.position, ea = [E0[0] - w.x, E0[1] + w.y * .6 - w.y, E0[2] - w.z];
  H.aimArm(ea);
  let fn;
  if (Q.cloth.pick >= 2) { const G = tipW(); fn = drapeTop(Q.cloth, [G.x, G.y - 0.006, G.z]); }
  else if (Q.cloth.pick === 1) { const G = tipW(), l = rot(-Q.cloth.th, G.x - Q.cloth.O[0], G.z - Q.cloth.O[1]); fn = clothTop({ ...Q.cloth, G: [l[0], l[1], G.y - 0.008] }); }
  else fn = clothTop(Q.cloth);
  s.cloth.geometry.dispose(); s.cloth.geometry = clothGeo(fn);
  surface(s.T, Q.u, mark);
  const pu = io(Math.min(1, lt / 1.5)), tg = [lerp(-0.075, 0.07, pu) + 0.012 * Math.max(0, lt - 1.5) / 1.5, 0, 0.012], d = 0.80, el = 58 * D2R;
  s.cam.position.set(tg[0], d * Math.sin(el), tg[2] + d * Math.cos(el)); s.cam.lookAt(...tg);
  draw3d(g, e, s.scene, s.cam);
  return {};
}
