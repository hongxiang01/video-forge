// fx.js —— 特效原画（CONTRACT「道具特效」）：雪（远 / 中 / 近三层，附 3）、台面雪影、S5 光里的面粉颗粒、热气（附 1）
// 雪、热气、颗粒都按 24 帧每帧动；热气缎带换张按 12 fps，颗粒闪按 8 fps。全部确定：只用 rng / hash，时间先量化到帧。
import { path, poly, line, rgba, mix, rng, hash, airbrush, TAU, W, H } from './lib/cel.js';
import { w2s, scale, WIN, TABLE, LAMP_STREET, shutterH } from './layout.js';
import { C, LIGHT, CORE, BG, SNOW } from './pal.js';

const f24 = t => Math.floor(t * 24 + 1e-6) / 24;
const wrap = (v, a, b) => a + (((v - a) % (b - a)) + (b - a)) % (b - a);
const clipTo = (g, c) => { if (!c) return; g.clip(c instanceof Path2D ? c : poly(c)); };

// ———————————— 雪（附 3） ————————————
// 层：远 = 喷枪软点（1 px 柔边），中 / 近 = 硬边平涂圆点，不描边不加高光；整体向左 12 px/s 风漂
export const SNOW_LAYERS = {
  far:  { n: 500, r: [1, 1.5], v: 35,  sway: 4,  col: SNOW.far,  par: .5, soft: true },
  mid:  { n: 160, r: [2, 3],   v: 70,  sway: 8,  col: SNOW.mid,  par: 1.0 },
  near: { n: 40,  r: [4, 6],   v: 140, sway: 14, col: SNOW.near, par: 1.8 },
};
// o = { layers:['far','mid','near'], clip（屏幕多边形 / Path2D）, wind（px/s，默认 −12）, crane（S8 降镜位移 px，各层乘视差系数）,
//       lamp:[x,y,r]（这个圈里的雪换成路灯金并以 60% 写进发光板）, grains3d:true（主构图：窗外那批三维雪粒按机位画进窗里，和台面雪影对得上）,
//       glass:true（暖灯：雪画完在裁切区里叠 15% 玻璃暖反光 BG.warm.glassTint，§4.3）, seed }
// 主构图窗里的雪：clip 用 winPanes(底杠高) —— 三格玻璃，扣掉两根窗棂
export function snow(g, e, t, o = {}) {
  t = f24(t);
  const layers = o.layers || ['far', 'mid', 'near'], wind = o.wind ?? -12, M = 40;
  g.save(); clipTo(g, o.clip); e.save(); clipTo(e, o.clip);
  for (const name of layers) {
    const L = SNOW_LAYERS[name], R = rng((o.seed || 0) + { far: 11, mid: 23, near: 37 }[name]);
    for (let i = 0; i < L.n; i++) {
      const x0 = R() * (W + 2 * M), y0 = R() * (H + 2 * M), r = L.r[0] + R() * (L.r[1] - L.r[0]);
      const fq = .3 + R() * .3, ph = R() * TAU, vk = .85 + R() * .3;
      const x = wrap(x0 + wind * t + L.sway * Math.sin(TAU * fq * t + ph), -M, W + M);
      const y = wrap(y0 + L.v * vk * t + (o.crane || 0) * L.par, -M, H + M);
      const lit = o.lamp && Math.hypot(x - o.lamp[0], y - o.lamp[1]) < o.lamp[2];
      const col = lit ? SNOW.lampSnow : L.col;
      if (L.soft) { g.fillStyle = rgba(col, .45); g.beginPath(); g.arc(x, y, r + 1, 0, TAU); g.fill(); }
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (lit) { e.fillStyle = rgba(SNOW.lampSnow, .6); e.beginPath(); e.arc(x, y, r + (L.soft ? 1 : 0), 0, TAU); e.fill(); }
    }
  }
  if (o.grains3d) for (const G of grains3d(t)) {
    const [x, y] = w2s(G.x, G.y, G.z), r = Math.max(1.6, G.r * scale(G.x, G.y, G.z));
    const lit = o.lamp && Math.hypot(x - o.lamp[0], y - o.lamp[1]) < o.lamp[2];
    g.fillStyle = lit ? SNOW.lampSnow : SNOW.near; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (lit) { e.fillStyle = rgba(SNOW.lampSnow, .6); e.beginPath(); e.arc(x, y, r, 0, TAU); e.fill(); }
  }
  if (o.glass) { g.fillStyle = rgba(BG.warm.glassTint, .15); g.fillRect(0, 0, W, H); }
  g.restore(); e.restore();
}
// 主构图的三格玻璃（屏幕 Path2D）：窗洞扣掉两根窗棂；h = 卷帘底杠高（落下来的部分不再透雪）
export function winPanes(h = WIN.y1) {
  const top = Math.min(h, WIN.y1), m = WIN.mullions, hw = WIN.mullionW / 2, out = new Path2D();
  if (top <= WIN.y0) return out;
  for (const [a, b] of [[WIN.x0, m[0] - hw], [m[0] + hw, m[1] - hw], [m[1] + hw, WIN.x1]])
    out.addPath(poly([w2s(a, top, WIN.z), w2s(b, top, WIN.z), w2s(b, WIN.y0, WIN.z), w2s(a, WIN.y0, WIN.z)]));
  return out;
}

// 窗外那一层三维雪粒（附 3「雪影」）：x −1.2…1.2、y 1.0…2.6、z 1.55…2.30，60 粒，半径 3–6 mm，
// 下落 0.6–0.9 m/s，风漂 x −0.15 m/s，摆 ±2 cm（0.5 Hz）。雪影和窗里的雪都用这一批。
// 附 3 写 60 粒。第 3 轮评委：静帧里 20–30 个雪影像脏点 → 回到 60 粒，台面上约 10–15 个（37.8 s 时 15 个，碗周围再让掉几个）。
export function grains3d(t, n = 60) {
  const R = rng(9091), out = [];
  for (let i = 0; i < n; i++) {
    const x0 = R() * 2.4 - 1.2, y0 = 1.0 + R() * 1.6, z = 1.55 + R() * .75, r = .003 + R() * .003, v = .6 + R() * .3, ph = R() * TAU;
    out.push({ x: wrap(x0 - .15 * t + .02 * Math.sin(TAU * .5 * t + ph), -1.2, 1.2), y: wrap(y0 - v * t, 1.0, 2.6), z, r });
  }
  return out;
}

// ———————————— 台面雪影（S1 0–0.75、S13 36.75–39.75） ————————————
// 每粒从路灯投到台面 y = 0.85：t = 5.40 / (6.25 − y粒)，落点 = 路灯 + (雪粒 − 路灯) × t。
// 只有射线穿过窗洞（不碰窗棂）、且高于卷帘底杠 h 的雪粒才有影子。影子 = 硬边椭圆，颜色只比光斑内的台面深一档。
// 第 3 轮：影子放大 1.5 倍、顺光线方向的拉长只留 3 成（更圆），读得出是一粒雪的影子，不像脏点。
// o = { shutter（底杠高，默认 shutterH(t)）, col（默认光斑内台面色往斑外色走 4 成）, clip }；返回所有影子的 Path2D
export function snowShadows(g, t, o = {}) {
  t = f24(t);
  const [lx, ly, lz] = LAMP_STREET, h = Math.min(o.shutter ?? shutterH(t), WIN.y1), out = new Path2D();
  const hw = WIN.mullionW / 2;
  for (const G of grains3d(t)) {
    const s = (lz - WIN.z) / (lz - G.z), xw = lx + (G.x - lx) * s, yw = ly + (G.y - ly) * s;
    if (xw < WIN.x0 || xw > WIN.x1 || yw < WIN.y0 || yw > h) continue;
    if (WIN.mullions.some(m => Math.abs(xw - m) < hw)) continue;
    const k = (ly - TABLE.y) / (ly - G.y), px = lx + (G.x - lx) * k, pz = lz + (G.z - lz) * k, rr = G.r * k * 1.5;
    const dx = px - lx, dz = pz - lz, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
    const st = 1 + (Math.hypot(dl, ly - TABLE.y) / (ly - TABLE.y) - 1) * .3;   // 1 / sin(仰角) 的拉长只留 3 成
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, p = rr * st * Math.cos(a), q = rr * Math.sin(a); pts.push(w2s(px + ux * p - uz * q, TABLE.y, pz + uz * p + ux * q)); }
    out.addPath(poly(pts));
  }
  g.save(); clipTo(g, o.clip); g.fillStyle = o.col || mix(BG.dark.woodIn, BG.dark.woodOut, .4); g.fill(out); g.restore();
  return out;
}

// ———————————— S5 光里的面粉颗粒（第 3 轮导演裁决：3–6 px 硬边圆点，放到面片下沿和外溢光带里，一半写进发光板闪；星芒只 1 个，在灯芯上） ————————————
// o = { edge: [[x, y, nx, ny]…] 面片下半圈外轮廓（外法线，props.doughBacklit 返回）, n（默认 26）, exclude: Path2D（面片：落进去的不画）,
//       glint: [x, y]（灯芯中心，给了才有星芒）, seed }
// 兼容旧调用（没给 edge）：{ lamp, c:[x,y], rx, ry, dy } → 撒在灯下 520 px 的椭圆里
export const FLOUR = { r: [1.6, 3.2], band: [6, 90], glintL: [172, 112], glintW: 7 };   // 半径 px（直径 3–6）；离面片外缘多远（外溢光带）；星芒横 / 竖臂长、臂根半宽
export function flourMotes(g, e, t, o = {}) {
  t = f24(t);
  const n = o.n || 26, R = rng(o.seed || 4243), step = Math.floor(t * 8), [r0, r1] = FLOUR.r, pts = [], [ox, oy] = o.off || [0, 0];
  if (o.edge && o.edge.length) {
    // 沿外轮廓取点（下沿权重大）→ 顺外法线往外 6–90 px；按 24 fps 慢慢往下飘（在 ±22 px 里循环）、左右晃
    // off：扣掉面片自己的举起 / 晃动位移（第 6 轮）→ 颗粒留在屋里的空气里，不粘着面片走
    while (pts.length < n) {
      const q = o.edge[Math.floor(R() * o.edge.length)], keep = R() < .3 + .7 * Math.max(0, q[3]), out = FLOUR.band[0] + (FLOUR.band[1] - FLOUR.band[0]) * R() ** 1.3;
      const vy = 4 + R() * 7, fq = .1 + R() * .18, ph = R() * TAU, r = r0 + (r1 - r0) * R(), k = R();
      if (keep) pts.push([q[0] + ox + q[2] * out + 7 * Math.sin(TAU * fq * t + ph), q[1] + oy + q[3] * out + wrap(vy * t + ph * 7, -22, 22), r, k]);
    }
  } else {
    const dy = o.dy || 0, lamp = o.lamp || [960, 330], [cx, cy0] = o.c || [lamp[0], lamp[1] + 520], cy = cy0 + dy, rx = o.rx || 420, ry = o.ry || 160;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = Math.sqrt(R()), vy = 5 + R() * 9, fq = .12 + R() * .2, ph = R() * TAU, r = r0 + (r1 - r0) * R(), k = R();
      const x = cx + Math.cos(a) * rx * d + 9 * Math.sin(TAU * fq * t + ph), y = cy + wrap(Math.sin(a) * ry * d + vy * t, -ry, ry);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pts.push([x, y, r, k]);
    }
  }
  for (const [x, y, r, k] of pts) {
    if (o.exclude && g.isPointInPath(o.exclude, x, y)) continue;      // 面片挡着的不画
    g.fillStyle = LIGHT.warm; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (hash(k * 97.3 + step * .618) < .5) { e.fillStyle = rgba(LIGHT.warm, .9); e.beginPath(); e.arc(x, y, r, 0, TAU); e.fill(); }   // 8 fps：每步约一半进发光板 → 闪
  }
  if (!o.glint) return;
  // 星芒：灯芯上一个细长四角星（横臂长、竖臂短，臂尖伸出灯芯、收在灯罩口暗环里面 → 在浅金上看得见），8 fps 臂长微微伸缩
  const [x, y] = o.glint, s = .88 + .12 * hash(step + .7), [lx, ly] = FLOUR.glintL.map(v => v * s), q = FLOUR.glintW;
  const P = poly([[x - lx, y], [x - q, y - q], [x, y - ly], [x + q, y - q], [x + lx, y], [x + q, y + q], [x, y + ly], [x - q, y + q]]);
  e.fillStyle = rgba(LIGHT.warm, .9); e.fill(P);   // 第 5 轮：颜色层不再画星芒，发光只从发光板来
}

// ———————————— 热气（附 1） ————————————
// 上层 cel 缎带：亮阶 + 背光一侧 35% 宽的暗阶，各自整块一个不透明度，并排不叠；朝灯一侧 2–4 px 暖边；亮阶同形 30% 进发光板。
// 形状按 12 fps 循环换张，上升位移每个输出帧都动；升到最后 25% 时按 3 张断开 → 缩小 → 消失（不做透明度渐隐）。
// 下层：喷枪柔雾，只往上平移 25 px/s，不变形。
// pal.js 没收热气色，按附 1 原值写在这里（待并入 pal.js）
export const STEAM = { hi: '#FFF4E0', lo: '#E2CCB4', rim: '#FFD08A', mist: '#F2E4CC' };
export const STEAM_PRESET = {
  S7:  { n: 5, w: [80, 160], len: [420, 700], v: 220, amp: 18, cyc: 4 },
  S9:  { n: 3, w: [40, 90],  len: [240, 400], v: 90,  amp: 10, cyc: 6 },
  S10: { n: 2, w: [30, 60],  len: [260, 320], v: 45,  amp: 6,  cyc: 6 },
  S8:  { n: 1, w: [50, 50],  len: [300, 300], v: 60,  amp: 8,  cyc: 6, night: true },
};
// 沿中线、在 [a, b]（占宽度的比例，−.5….5）之间的硬边带；px 是额外的像素偏移
function band(sp, wf, a, b, pa = 0, pb = 0) {
  const n = sp.length, A = [], B = [];
  for (let i = 0; i < n; i++) {
    const p = sp[Math.max(0, i - 1)], q = sp[Math.min(n - 1, i + 1)]; let dx = q[0] - p[0], dy = q[1] - p[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wf(i / (n - 1)), nx = -dy, ny = dx;
    A.push([sp[i][0] + nx * (a * w + pa), sp[i][1] + ny * (a * w + pa)]); B.push([sp[i][0] + nx * (b * w + pb), sp[i][1] + ny * (b * w + pb)]);
  }
  return path(A.concat(B.reverse()));
}
// o = { x, y（热气根部，屏幕）, preset:'S7'|'S9'|'S10'|'S8', spread（根部横向散开 px）, lampSide（−1 灯在左 / 1 灯在右）, mist（默认 true）, seed }
export function steam(g, e, t, o = {}) {
  t = f24(t);
  const P = { ...STEAM_PRESET[o.preset || 'S9'], ...(o.cfg || {}) }, night = !!P.night, R = rng(o.seed || 777);
  const x0 = o.x ?? 960, y0 = o.y ?? 700, spread = o.spread ?? P.w[1], side = o.lampSide ?? -1;
  const hi = night ? SNOW.mid : STEAM.hi, lo = night ? SNOW.far : STEAM.lo, d12 = Math.floor(t * 12);
  // 下层柔雾
  if (o.mist !== false) for (let k = 0; k < P.n + 1; k++) {
    const span = P.len[1] * .9, yy = y0 - wrap(25 * t + k * span / (P.n + 1), 0, span), xx = x0 + (k - P.n / 2) * spread * .5;
    airbrush(g, xx, yy, 60 + P.w[1] * .4, 60 + P.w[1] * .3, night ? SNOW.far : STEAM.mist, .3, .9);
  }
  for (let i = 0; i < P.n; i++) {
    const W0 = P.w[0] + R() * (P.w[1] - P.w[0]), L0 = P.len[0] + R() * (P.len[1] - P.len[0]), off = R(), xo = (R() - .5) * spread * 2, waves = .9 + R() * .6;
    const life = L0 / P.v, u = wrap(t / life + off, 0, 1);                       // 这一缕的一生：0 → 1
    const yb = y0 - u * L0 * .9, grow = u < .15 ? .45 + .55 * Math.floor(u / .15 * 3) / 3 : 1;
    const ph = (d12 % P.cyc) / P.cyc * TAU, Lw = L0 * grow;
    // 中线：从根部往上，正弦摆（摆幅取附 1），上半段再往一侧慢慢弯（12 fps 循环换张）
    const lean = (R() < .5 ? -1 : 1) * (.1 + R() * .12) * Lw, sp = [];
    for (let j = 0; j <= 20; j++) { const s = j / 20, sw = Math.sin(s * waves * TAU - ph + i * 1.7) * P.amp * (.5 + s); sp.push([x0 + xo + sw + lean * s * s, yb - s * Lw]); }
    // 宽度：一节一节鼓起又收细（像一串气团），越往上越细，顶端收尖
    const wf = s => W0 * (.42 + .58 * (.5 + .5 * Math.sin(s * 3 * Math.PI - ph * .5 + i))) * (1 - .45 * s) * Math.min(1, (1 - s) / .14, .45 + s / .08);
    // 断开：最后 25% 寿命按 3 张
    const brk = u < .75 ? -1 : Math.min(2, Math.floor((u - .75) / .25 * 3));
    const pieces = brk < 0 ? [[0, 1, 1]] : brk === 0 ? [[0, .42, 1], [.54, 1, 1]] : brk === 1 ? [[0, .26, .7], [.38, .6, .7], [.72, 1, .7]] : [[.05, .2, .4], [.42, .55, .4], [.75, .9, .4]];
    for (const [a, b, sc] of pieces) {
      const j0 = Math.round(a * 20), j1 = Math.max(j0 + 2, Math.round(b * 20)), cy = (sp[j0][1] + sp[j1][1]) / 2, cx = (sp[j0][0] + sp[j1][0]) / 2;
      const seg = sp.slice(j0, j1 + 1).map(([x, y]) => [cx + (x - cx) * sc, cy + (y - cy) * sc]);
      const wseg = s => wf(a + (b - a) * s) * sc * (brk < 0 ? 1 : Math.sin(Math.PI * Math.min(1, .15 + s * .85)) * .8 + .2);
      // 亮阶在朝灯一侧 65%，暗阶在背光一侧 35%（side = −1：灯在左 → 暗阶在右）
      const [la, lb, da, db] = side < 0 ? [-.5, .15, .15, .5] : [-.15, .5, -.5, -.15];
      const Phi = band(seg, wseg, la, lb), Plo = band(seg, wseg, da, db);
      g.fillStyle = rgba(hi, .85); g.fill(Phi);
      g.fillStyle = rgba(lo, .70); g.fill(Plo);
      e.fillStyle = rgba(hi, .3); e.fill(Phi);
      if (!night) { const edge = side < 0 ? -.5 : .5; g.fillStyle = rgba(STEAM.rim, .9); g.fill(band(seg, wseg, edge, edge, 0, -side * 3)); }
    }
  }
}

// ———————————— 测试页 ?test=fx ————————————
// 2.0 主构图 A 窗里的雪（暖灯）；37.8 主构图 A' 窗里的雪 + 台面雪影；13.8 S5 面粉颗粒；19.5 S7 热气；25 S9 热气；22 S8 全画面三层雪 + 排气口白汽
function winPoly(h = WIN.y1) { return [w2s(WIN.x0, h, WIN.z), w2s(WIN.x1, h, WIN.z), w2s(WIN.x1, WIN.y0, WIN.z), w2s(WIN.x0, WIN.y0, WIN.z)]; }
export const LAMP_WIN = [1380, 60, 260];       // 窗里被路灯头照亮的雪（§4.1：窗右上 x 1180–1580，y 55–200）
export function test(g, e, t, A) {
  const P = A && A.mods && A.mods.props;
  if (t < 12 || t >= 36) {
    const warm = t < 36, pl = A && A.plateA;
    if (pl) { const p = warm ? pl.warm : pl.darkOut; g.drawImage(p.c, 0, 0); e.drawImage(p.e, 0, 0); }
    else { g.fillStyle = warm ? BG.warm.wallFar : BG.dark.wallFar; g.fillRect(0, 0, W, H); g.fillStyle = BG.night.indigo; g.fill(poly(winPoly())); }
    if (!warm && pl && P && P.spotMask) { g.save(); g.clip(P.spotMask(shutterH(t))); g.drawImage(pl.darkIn.c, 0, 0); g.restore(); }
    snow(g, e, t, { layers: ['far', 'mid'], clip: winPanes(shutterH(t)), lamp: LAMP_WIN, grains3d: true, glass: warm });
    if (!warm) snowShadows(g, t, {});
    return {};
  }
  if (t < 15) {
    g.fillStyle = BG.warm.woodDark; g.fillRect(0, 0, W, H);
    airbrush(g, 960, 330, 900, 700, BG.warm.woodHalo, .8, .9); airbrush(e, 960, 330, 820, 640, LIGHT.warm, .7, .9);
    if (P && P.doughBacklit) P.doughBacklit(g, e, { t });
    flourMotes(g, e, t, {});
    return {};
  }
  if (t >= 21 && t < 24) {
    g.fillStyle = BG.night.indigo; g.fillRect(0, 0, W, H);
    g.fillStyle = mix(BG.night.indigo, '#000000', .3); g.fillRect(560, 380, 800, 700);
    steam(g, e, t, { preset: 'S8', x: 1240, y: 420, spread: 10 });
    snow(g, e, t, { lamp: [380, 240, 180] });
    return {};
  }
  const s7 = t < 21;
  g.fillStyle = s7 ? C('pot').s : BG.warm.woodDark; g.fillRect(0, 0, W, H);
  if (s7) { g.fillStyle = C('pot').f; g.beginPath(); g.ellipse(960, 760, 760, 380, 0, 0, TAU); g.fill(); }
  else { const cb = C('bowl'); g.fillStyle = cb.f; g.beginPath(); g.ellipse(960, 820, 420, 170, 0, 0, TAU); g.fill(); g.fillStyle = C('rim').f; g.lineWidth = 14; g.strokeStyle = C('rim').f; g.stroke(); }
  steam(g, e, t, s7 ? { preset: 'S7', x: 960, y: 820, spread: 260, lampSide: -1 } : { preset: 'S9', x: 960, y: 800, spread: 120, lampSide: -1 });
  return {};
}
