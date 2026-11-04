// props.js —— 道具原画（CONTRACT「道具特效」）：灯罩 + 灯泡 + 灯绳木珠、红沿碗、面盆、擀面杖、围裙、湿布弧痕、面粉、S5 逆光面片
// 主构图位置全部从 layout.js 的 OBJ / SHADE / CORD 算（世界坐标 → w2s）；颜色全部取 pal.js。
// 光照 o.light：'warm' 暖灯；'in' / 'out' 灯灭整件按光斑内 / 外；'dark' 灯灭且自动按光斑遮罩分两遍（外色整画，裁进光斑再画内色）。
// 灯灭时光斑遮罩：o.spot（屏幕多边形或 Path2D）优先；没给就按 o.shutter（卷帘底杠高，默认 1.85）用 spotMask() 算。
import { cel, path, poly, line, ribbon, rgba, mix, hex, rng, hash, airbrush, canvas, TAU, W, H } from './lib/cel.js';
import { w2s, scale, WIN, TABLE, SHADE, CORD, HALO, OBJ, LAMP_STREET } from './layout.js';
import { C, LIGHT, CORE, BG, SIL, SNOW } from './pal.js';

// ———————————— 几何小工具 ————————————
// 投影器：默认 w2s；画碗摞时临时换成「竖线收一半」的版本（见 bowl()）
let PROJ = null;
const P = q => PROJ ? PROJ(q) : w2s(q[0], q[1], q[2]);
const ring = (c, r, y, n = 48, a0 = 0, a1 = TAU) => {
  const o = [], closed = a1 - a0 >= TAU - 1e-6, m = closed ? n : n + 1;
  for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n; o.push([c[0] + r * Math.cos(a), y, c[2] + r * Math.sin(a)]); }
  return o;
};
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const sp = pts3 => pts3.map(P);
const norm = (v, k) => { const d = Math.hypot(v[0], v[1]) || 1; return [v[0] / d * k, v[1] / d * k]; };

// 灯：摆角 swing（度，正 = 灯往右摆），绕罩顶上方 PIV 在 x–y 平面里转（一拍一摆 0.75 s ≈ 14 cm 摆长，光圈扫约 ±50 px）
const PIV = [SHADE.c[0], SHADE.c[1] + 0.14, SHADE.c[2]];
const rot = (q, deg, pv = PIV) => {
  const a = deg * Math.PI / 180, dx = q[0] - pv[0], dy = q[1] - pv[1];
  return [pv[0] + dx * Math.cos(a) - dy * Math.sin(a), pv[1] + dx * Math.sin(a) + dy * Math.cos(a), q[2]];
};
export const bulbPos = (swing = 0) => rot([SHADE.c[0], SHADE.c[1] - 0.07, SHADE.c[2]], swing);   // 灯泡中心（世界）
// S1 开灯后的摆：±4° → ±2.4° → ±1.2°，一拍一摆（0.75 s），0.75 s 起；S13 不摆罩（只摆灯绳，见 fx/合成）
export function swingAt(t) {
  if (t < 0.75 || t > 3.0) return 0;
  const u = t - 0.75, k = Math.min(2, Math.floor(u / 0.75)), A = [4, 2.4, 1.2][k];
  return A * Math.sin(u / 0.75 * Math.PI) * (k % 2 ? -1 : 1) * (u > 2.25 ? 0 : 1);
}
// 光源（世界）：暖灯 = 灯泡；灯灭 = 窗外路灯
const lightSrc = (L, o) => L === 'warm' ? bulbPos(o.swing || 0) : LAMP_STREET;
// 屏幕上从物体指向光源的方向（k px）——cel 的 so（阴影）用它，ho（高光）取反
function toward(p3, L3, k) {
  const q = [p3[0] + (L3[0] - p3[0]) * .05, p3[1] + (L3[1] - p3[1]) * .05, p3[2] + (L3[2] - p3[2]) * .05];
  const a = P(p3), b = P(q); return norm([b[0] - a[0], b[1] - a[1]], k);
}
// 只取光的水平方向（容器内壁的影子用：灯在正上方时屏幕方向会被高度带偏）
function towardH(p3, L3, k) { return toward(p3, [L3[0], p3[1], L3[2]], k); }
// 点光源把世界点投到台面 y = TABLE.y（硬边投影）
function onTable(G, L) { const k = (L[1] - TABLE.y) / Math.max(1e-3, L[1] - G[1]); return [L[0] + (G[0] - L[0]) * k, TABLE.y, L[2] + (G[2] - L[2]) * k]; }

// 路灯穿窗落到高度 y 的光斑：窗棂把它分成三块，返回 Path2D（三块并起来）；底杠 h 以上的光被卷帘挡掉
export function spotMask(h = 1.85, y = TABLE.y) {
  const [lx, ly, lz] = LAMP_STREET, d = lz - WIN.z, top = Math.min(h, WIN.y1);
  if (top <= WIN.y0) return null;
  const zAt = yw => lz - (ly - y) * d / (ly - yw), xAt = (xw, z) => lx + (xw - lx) * (lz - z) / d;
  const zf = zAt(top), zb = zAt(WIN.y0), m = WIN.mullions, hw = WIN.mullionW / 2, out = new Path2D();
  for (const [a, b] of [[WIN.x0, m[0] - hw], [m[0] + hw, m[1] - hw], [m[1] + hw, WIN.x1]])
    out.addPath(poly([[a, zb], [b, zb], [b, zf], [a, zf]].map(([xw, z]) => w2s(xAt(xw, z), y, z))));
  return out;
}
// 灯灭两遍画法：外色整件 → 裁进光斑画内色
function lit(g, o, y, fn) {
  if (o.light !== 'dark') return fn(o.light || 'warm');
  fn('out');
  const m = o.spot !== undefined ? o.spot : spotMask(o.shutter ?? 1.85, y);
  if (!m) return;
  g.save(); g.clip(m instanceof Path2D ? m : poly(m)); fn('in'); g.restore();
}
// 硬边投影（影赛璐）：暖灯 = 台面暗部紫半透明；灯灭光斑内 = 光斑外的台面色（等于从光斑里挖掉一块）
// dy：整块下移的 px（单只碗外壁在画面上加长后，投影跟着碗底圈走）
function castShadow(g, pts3, L, o, dy = 0) {
  const src = lightSrc(L, o);
  if (L === 'out') return;
  const sh = poly(hull(pts3.map(q => P(onTable(q, src))).concat(sp(pts3.filter(q => q[1] < TABLE.y + 0.004)))).map(([x, y]) => [x, y + dy]));
  g.fillStyle = L === 'warm' ? rgba(BG.warm.woodDark, .55) : BG.dark.woodOut; g.fill(sh);
}
// 第 5 轮：灯灭（路灯）硬边投影——顶圈经点光源投到台面，投出的长度放大 k 倍（真实只出 1–3 cm，读不出来）；方向仍是路灯的，和窗棂影同一个消失点
// fr：投出那一端的屏幕点再过一道变换（面盆整件转回了 7 成，影尖要按真实屏幕方向走，见 scenes basinCheat 的 o.rot）
function dropShadow(g, base3, top3, src, k, col, dy = 0, fr = q => q) {
  const st = top3.map(q => { const t = onTable(q, src); return [q[0] + (t[0] - q[0]) * k, TABLE.y, q[2] + (t[2] - q[2]) * k]; });
  g.fillStyle = col; g.fill(poly(hull(sp(base3).concat(sp(st).map(fr))).map(([x, y]) => [x, y + dy])));
}
const DROP = () => mix(BG.dark.woodOut, BG.dark.woodDark, .45);   // 物件投影比窗棂影深一档
const stamp = (e, P2) => { e.fillStyle = '#000'; e.fill(P2); };   // cel 挡住发光体：在发光板上印黑

// ———————————— 灯罩 + 灯泡 + 灯绳木珠 ————————————
// o = { light:'warm'|'dark', on:(默认 light==='warm'), swing:度, cordSwing:度（默认 = swing）, pull:米（木珠被往下拉）, cordBend:米（绳中段侧弯） }
const BEAD_R = 0.0125;
function cordPts(o) {
  const top = rot(CORD.top, o.swing || 0), L = top[1] - CORD.bottomY + (o.pull || 0);
  const a = (o.cordSwing ?? o.swing ?? 0) * Math.PI / 180, bend = o.cordBend || 0, n = 14, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = L * u, off = bend * Math.sin(u * Math.PI);
    pts.push([top[0] + s * Math.sin(a) + off * Math.cos(a), top[1] - s * Math.cos(a) + off * Math.sin(a), top[2]]);
  }
  return pts;
}
// 木珠的屏幕位置（给手 / 合成用）：{ x, y, r }
export function beadPos(o = {}) {
  const q = cordPts(o).at(-1), b = [q[0], q[1] - BEAD_R, q[2]], [x, y] = P(b);
  return { x, y, r: BEAD_R * scale(...b), w: b };
}
export function shade(g, e, o = {}) {
  const L = o.light || 'warm', on = o.on ?? L === 'warm', sw = o.swing || 0, Lc = L === 'warm' ? 'warm' : 'out';
  const cs = C('shade', Lc), cc = C('cord', Lc), [cx, cy, cz] = SHADE.c, R = SHADE.r;
  const R3 = (r, y, n, a0, a1) => ring([cx, 0, cz], r, y, n, a0, a1).map(q => rot(q, sw));
  // 吊线（从罩顶出画）
  const wa = P(rot([cx, cy + 0.12, cz], sw)), wb = P([cx, cy + 0.9, cz]);
  line(g, [wb, wa], cc.l, 3.2); line(g, [wb, wa], cc.s, 1.4); line(e, [wb, wa], '#000', 3.2);
  // 灯泡：玻璃大半露在罩口下面（老式拉线灯头 + 浅搪瓷罩）
  const bc = bulbPos(sw), [bx, by] = P(bc), bs = scale(...bc), brx = 0.033 * bs, bry = 0.042 * bs;
  const bulb = new Path2D(); bulb.ellipse(bx, by, brx, bry, sw * Math.PI / 180, 0, TAU);
  if (on) {
    // 第 4 轮（评委：晕泛粉紫、中心 130 px 一片纯白）：发光板里的灯泡用光色 #FFE6B8 不用白，核心收小；外面一圈宽的染红橙（玻璃暖色往碗沿红走），
    // 只铺在罩口以下（罩身随后印黑）；颜色板上的灯泡也用光色，只留一小块 CORE 硬高光；CRT 抬高颜色板的 bloom 阈值（scenes CRT.a.thr）
    airbrush(e, bx, by + bry * 1.2, 150, 96, BG.warm.glassTint, .5, .85);
    airbrush(e, bx, by, brx * 1.25, bry * 1.2, LIGHT.warm, .5, .5);
    e.fillStyle = LIGHT.warm; e.fill(bulb);
    cel(g, bulb, { f: LIGHT.warm, l: mix(LIGHT.warm, cc.l, .35), lw: 1.6 });
    g.fillStyle = CORE; g.beginPath(); g.ellipse(bx - brx * .25, by - bry * .1, brx * .35, bry * .45, 0, 0, TAU); g.fill();
  } else {
    const cb = C('bowl', Lc);
    cel(g, bulb, { f: cb.f, s: cb.s, so: [-brx * .45, 0], l: cb.l, lw: 1.6 });
    g.fillStyle = cb.h; g.beginPath(); g.ellipse(bx + brx * .4, by - bry * .25, brx * .16, bry * .32, 0, 0, TAU); g.fill();
    stamp(e, bulb);
  }
  // 灯绳（上端在罩里，被罩挡住）+ 木珠
  cord(g, e, o, L);
  // 罩身：浅锥，口 r = 0.18 / y 1.95，顶 r = 0.05 / y 2.04，灯头帽 r = 0.025 到 y 2.09
  const rim = R3(R, cy, 64), top = R3(0.05, cy + 0.09, 32), cap = R3(0.026, cy + 0.14, 16);
  const body = poly(hull(sp(rim.concat(top))));
  const so = Lc === 'warm' ? [-30, 8] : [-22, 10];
  cel(g, poly(hull(sp(top.concat(cap)))), { f: cs.s, l: cs.l, lw: 2 });
  cel(g, body, { f: cs.f, s: cs.s, so, l: cs.l, lw: 2.5, rim: Lc === 'warm' ? null : { c: BG.night.snowGrey, d: [-2.5, -2] } });
  // 搪瓷硬高光：前左一条母线带
  const gen = (a0, a1) => poly(sp(R3(R * .97, cy + 0.004, 6, a0, a1).concat(R3(0.055, cy + 0.085, 6, a0, a1).reverse())));
  g.save(); g.clip(body); g.fillStyle = cs.h; g.fill(gen(3.62, 3.86)); g.fill(gen(3.98, 4.04)); g.restore();
  // 卷边：前半圈罩口的厚边；开灯时边下缘一道暖光（罩里白搪瓷反出来）
  const front = sp(R3(R, cy, 40, Math.PI, TAU));
  line(g, front, cs.l, 5); line(g, front.map(([x, y]) => [x, y - 2.5]), mix(cs.f, cs.h, .5), 1.6);
  stamp(e, body);
  if (on) {   // 开灯：卷边下缘一道暖光（罩里白搪瓷反出来），同形进发光板
    const lip = front.slice(2, -2).map(([x, y]) => [x, y + 1.8]);
    line(g, lip, CORE, 2.4); line(e, lip, CORE, 3);
  }
  return { bulb: [bx, by], bead: beadPos(o) };
}
function cord(g, e, o, L) {
  // 第 5 轮（导演：720p 下只剩一根虚线）：绳芯 3.4 px + 两侧各约 1.3 px 深色描边；木珠画成直径约 24 px（位置仍按 BEAD_R，手捏的点不动）+ 硬边高光；
  // A：木珠在光圈里投一个硬边小影点（灯泡经木珠投到台面）；A'：朝窗一侧 1 px 冷色轮廓光
  const Lc = L === 'warm' ? 'warm' : 'out', cc = C('cord', Lc), pts = cordPts(o), s2 = sp(pts);
  const b = beadPos(o), br = Math.max(b.r, 12), src = lightSrc(Lc, o), cb = C('pin', Lc), lt = toward(b.w, src, 1);
  if (L === 'warm') {
    const sc = onTable(b.w, src), k = (src[1] - TABLE.y) / Math.max(1e-3, src[1] - b.w[1]);
    g.fillStyle = rgba(BG.warm.woodDark, .6); g.fill(poly(sp(ring(sc, BEAD_R * k * br / b.r, TABLE.y, 24))));
  }
  line(e, s2, '#000', 6.5);
  line(g, s2, cc.l, 6); line(g, s2, cc.f, 3.4);
  if (L !== 'warm') line(g, s2.map(([x, y]) => [x + 2.3, y]), BG.night.snowGrey, 1);   // 窗前逆光：朝窗一侧 1 px 冷轮廓
  // 木珠
  const B = new Path2D(); B.ellipse(b.x, b.y, br, br * 1.08, 0, 0, TAU);
  cel(g, B, { f: cb.f, s: cb.s, so: [lt[0] * br * .5, lt[1] * br * .5], l: cb.l, lw: 2.2 });
  g.fillStyle = L === 'warm' ? mix(cb.f, LIGHT.warm, .65) : mix(cb.f, BG.night.snowGrey, .6);   // 硬边高光：朝光一侧一块小椭圆
  g.beginPath(); g.ellipse(b.x + lt[0] * br * .4, b.y + lt[1] * br * .4, br * .3, br * .19, Math.atan2(lt[1], lt[0]) + Math.PI / 2, 0, TAU); g.fill();
  if (L !== 'warm') { g.save(); g.clip(B); g.fillStyle = BG.night.snowGrey; g.fill(poly([[b.x + br * .62, b.y - br * 2], [b.x + br * 2, b.y - br * 2], [b.x + br * 2, b.y + br * 2], [b.x + br * .8, b.y + br * 2]])); g.restore(); }
  stamp(e, B);
}

// ———————————— 红沿碗 ————————————
// o = { at:'A'（五只摞，OBJ.stackA）| 'A2'（一只正放，OBJ.bowlA2）, c:[x,y,z] 碗底中心, r 口半径, h 碗高, n 只数, H 摞高, light, spot, shutter, swing,
//       lean（摞的竖线保留几成透视倾斜，默认 .3）, ext（单只碗外壁在画面上往下加长的 px，默认自动补到近沿下约 20 px） }
// 外形：圈足 r·0.42 → 碗口 r，壁外凸；红带：碗口一圈朝上的环（径向 RIM_W，o.rimW 可覆盖）+ 外壁一窄条
const bowlR = (r, u) => r * .42 + r * .58 * (1 - (1 - u) * (1 - u));
// 碗口红环径向宽：A' 那只单碗按 §4.1 画 3 cm（近侧约 12 px）；A 的碗摞 2.2 cm（五只都画 3 cm 时整摞成了一根红柱，点缀色变成主色）
const RIM_W = { one: .03, stack: .022 };
// 灯灭时碗沿受光色在 CRT 前的补偿：CRT 的对比 S 曲线 + 扫描线 + 色度拖尾会把 12 px 的红带压暗、冲淡，过完 CRT 要回到约 #731F32（§4.3）
// 第 4 轮（评委：亮的一段 L 只有约 .31，全靠饱和度撑着）：红通道再提一档，过完 CRT 仍是全画面唯一暖而饱和、也最亮的红
const RIM_GAIN = [1.34, 1.12, 1.08];
const gain = (c, k) => '#' + hex(c).map((v, i) => Math.min(255, Math.round(v * k[i])).toString(16).padStart(2, '0')).join('');
// ext：碗口以下的外壁在屏幕上往下多拉 ext px（按离碗口的高度线性分配；碗口和碗里不动）
function bowlGeom(c, r, h, ext = 0, bh = .012, rw = RIM_W.one) {
  const rimY = c[1] + h, at = (rr, y, n = 48) => ring(c, rr, y, n);
  const Po = q => { const [x, y] = P(q); return [x, y + ext * Math.max(0, Math.min(1, (rimY - q[1]) / h))]; }, spo = pts => pts.map(Po);
  const rings = [0, .12, .3, .5, .7, .88, 1].map(u => at(bowlR(r, u), c[1] + h * u, 40)), uo = (h - bh) / h;
  return {
    rimY, Po,
    out: poly(hull(spo(rings.flat()))),
    rimE: poly(sp(at(r, rimY, 64))),
    inner: poly(sp(at(r - rw, rimY - .006, 64))),          // 红环里沿
    well: poly(sp(at(r * .55, rimY - .045, 48))),             // 碗心（里壁往下的暗面分界）
    band: poly(hull(spo(at(r, rimY, 48).concat(at(bowlR(r, uo), rimY - bh, 48))))),
    floor: poly(sp(at(r * .34, c[1] + .012, 40))),
  };
}
// 母线带（侧壁上一条竖向硬高光）：角度 a±da，从高度 u0 到 u1；pr = 投影器
function genBand(c, rf, h, a, da, u0, u1, pr = P) {
  const L = [], R = [];
  for (let i = 0; i <= 6; i++) { const u = u0 + (u1 - u0) * i / 6, r = rf(u), y = c[1] + h * u; L.push([c[0] + r * Math.cos(a - da), y, c[2] + r * Math.sin(a - da)]); R.push([c[0] + r * Math.cos(a + da), y, c[2] + r * Math.sin(a + da)]); }
  return poly(L.concat(R.reverse()).map(pr));
}
// 亮侧的可见母线角：光从左来取前左，从右来取前右
const litAngle = (c, src) => (src[0] < c[0] ? 3.85 : 5.55);
// 近沿下真实透视里露出多少 px 外壁（碗口前点到外壁最低点）
function wallDrop(c, r, h) {
  const fr = P([c[0], c[1] + h, c[2] - r])[1];
  return Math.max(...[0, .12, .3, .5, .7, .88].map(u => P([c[0], c[1] + h * u, c[2] - bowlR(r, u)])[1])) - fr;
}
// top = false：摞在下面的碗，碗口里只看得到上一只的外壁落在暗处（整块影色），不画碗里
function bowlOne(g, e, c, r, h, L, o, clip, top = true, ext = 0, rw = RIM_W.one) {
  const src = lightSrc(L, o), back = src[2] > c[2] + .5;   // 光从碗后面来（灯灭：路灯在窗外）→ 朝机位的外壁整面在影里
  // 第 5 轮（导演）：A 的碗摞在光圈外，碗身白往影色压 o.dim（明度约 .75），暗部加大一倍；红沿不压，仍是全画面彩度最高
  const G = bowlGeom(c, r, h, ext, back ? .007 : .008, rw), cb0 = C('bowl', L), cr = C('rim', L), dim = L === 'warm' ? o.dim || 0 : 0;
  const cb = dim ? { ...cb0, f: mix(cb0.f, cb0.s, dim), h: mix(cb0.h, cb0.s, dim * .8) } : cb0;
  const k = r * scale(...c), so = toward([c[0], G.rimY, c[2]], src, Math.max(5, k * (dim ? .34 : .16))), si = towardH([c[0], G.rimY, c[2]], src, Math.max(4, k * (dim ? .26 : .14)));
  const rimLit = L === 'warm' ? cr.f : gain(cr.f, RIM_GAIN);
  if (clip) { g.save(); g.clip(clip, 'evenodd'); e.save(); e.clip(clip, 'evenodd'); }
  if (back) {
    // 逆光：外壁整面影色（近沿下约 20 px），碗口下的红条也是影色；壁的下沿一道台面反上来的光（硬边），外壁才读得出是一只碗
    cel(g, G.out, { f: cb.s, h: mix(cb.s, cb.f, .4), ho: [0, -Math.max(4, k * .1)], l: cb.l, lw: 1.8 });
    g.fillStyle = cr.s; g.fill(G.band);
  } else {
    cel(g, G.out, { f: cb.f, s: cb.s, so });
    g.save(); g.clip(G.out); g.fillStyle = cb.h; g.fill(genBand(c, u => bowlR(r, u), h, litAngle(c, src), .09, .25, .8, G.Po)); g.restore();
    cel(g, G.band, { f: rimLit, s: cr.s, so: [so[0] * .5, so[1] * .5] });
  }
  // 碗口：整圈红环（受光平涂，不压影子，点缀色要一直跳出来）→ 里沿以内是白瓷碗里
  g.fillStyle = rimLit; g.fill(G.rimE);
  g.save(); g.clip(G.rimE);
  if (top) {
    cel(g, G.inner, { f: cb.f, s: cb.s, so: [-si[0], -si[1]] });
    g.save(); g.clip(G.inner); g.fillStyle = rgba(cb.s, .55); g.fill(G.well); line(g, G.floor, mix(cb.f, cb.l, .35), 1.2, true); g.restore();
  } else {
    g.fillStyle = cb.s; g.fill(G.inner);
  }
  g.restore();
  g.strokeStyle = cb.l; g.lineWidth = back ? 1.6 : 2.2; g.lineJoin = 'round'; g.stroke(G.out);
  g.lineWidth = 1.4; g.strokeStyle = cr.l; g.stroke(G.rimE); g.lineWidth = 1.2; g.stroke(G.inner);
  if (back) {
    // 逆光：远沿顶上一道 1–2 px 硬边高光（光色），光斑里唯一一个被照亮的点（只在光斑内那一遍画）
    if (L === 'in') {
      line(g, sp(ring(c, r * .995, G.rimY + .002, 24, .12 * Math.PI, .88 * Math.PI)), LIGHT.in, 1.7);
      // 第 4 轮：近沿外口一道 2 px 冷高光（路灯被满窗落雪冲成的冷光），冷光贴着暖红，红沿才跳得出来
      line(g, sp(ring(c, r * 1.004, G.rimY + .001, 28, 1.14 * Math.PI, 1.86 * Math.PI)), LIGHT.in, 2);
    }
  } else {
    // 红沿上一段硬高光（朝光那段碗口）
    const aL = Math.atan2(src[2] - c[2], src[0] - c[0]);
    line(g, sp(ring(c, r * .985, G.rimY + .001, 10, aL - .35, aL + .35)), cr.h, 2.2);
  }
  stamp(e, G.out); stamp(e, G.rimE);
  if (clip) { g.restore(); e.restore(); }
  return G;
}
export function bowl(g, e, o = {}) {
  const stack = (o.at || 'A') === 'A' && !o.c ? OBJ.stackA : null, one = OBJ.bowlA2;
  const c = o.c || (stack ? stack.c : one.c), r = o.r || one.r, h = o.h || one.h;
  const n = o.n || (stack ? stack.n : 1), Ht = o.H || (stack ? stack.h : h), step = n > 1 ? (Ht - h) / (n - 1) : 0;
  const ext = n > 1 ? 0 : o.ext ?? Math.max(0, 20 - wallDrop(c, r, h));
  // 摞（0.30 m 高、在画面右缘）：真实三点透视下竖线往外斜约 35°（§4.1 底 (1662, 861) → 顶 (1753, 730)），第 2 轮美术评委看着像要倒；
  // 第 3 轮转回到只剩约 10°，画风评委又说几乎竖直、和窗棂收拢的透视对不上。
  // 第 4 轮折中：碗心、碗口都先照 w2s 算，再把整摞绕碗底中心转回，透视外倾只留 lean 成（默认 .55：约 19°、顶心往外约 50 px，
  // 和窗框右边那根竖线的收拢差不多）；碗底中心钉在 w2s 上，接触影贴紧碗底，台面投影照真实透视
  const keep = o.lean ?? .55, pv = w2s(...c), prevProj = PROJ;
  let upright = prevProj;
  if (n > 1) {   // 整摞绕碗底中心转回 (1 − lean) 成：碗心连线和碗口椭圆一起转，整摞是一个刚体（只错切的话碗口还是真透视的斜，像在往下滑）
    const tp = w2s(c[0], c[1] + Ht, c[2]), th = -(1 - keep) * Math.atan2(tp[0] - pv[0], pv[1] - tp[1]), cs = Math.cos(th), sn = Math.sin(th);
    upright = q => { const [x, y] = w2s(q[0], q[1], q[2]), dx = x - pv[0], dy = y - pv[1]; return [pv[0] + dx * cs - dy * sn, pv[1] + dx * sn + dy * cs]; };
  }
  lit(g, o, c[1] + h, L => {
    const src = lightSrc(L, o), away = norm([c[0] - src[0], c[2] - src[2]], 1);
    PROJ = prevProj;
    if (n > 1 || L === 'warm') {
      // 投影：碗底圈 + 最上一只碗口投到台面；单只碗的外壁加长了 ext，投影跟着碗底圈一起下移
      castShadow(g, ring(c, r * .42, c[1] + .002, 24).concat(ring(c, r, c[1] + (n - 1) * step + h, 32)), L, o, ext);
    } else if (L === 'in') {
      // A' 单只碗（第 5 轮导演：碗已挪到两道窗棂影之间）：路灯经碗口投到台面的硬边影，朝左下、和窗棂影同一个消失方向，长度放大 2 倍；比窗棂影深一档
      dropShadow(g, ring(c, r * .42, c[1] + .002, 24), ring(c, r, c[1] + h, 32), src, 1.6, DROP(), ext);
    }
    PROJ = upright;
    // 接触影：贴住碗底的硬边暗椭圆，往背光一侧偏一点（摞：底碗口径的 .62，贴紧圈足外）
    const cc = [c[0] + away[0] * r * .1, c[1], c[2] + away[1] * r * .1];
    g.fillStyle = L === 'warm' ? rgba(BG.warm.woodDark, .9) : BG.dark.woodDark;
    g.fill(poly(sp(ring(cc, r * (n > 1 ? .8 : .56), c[1], 40)).map(([x, y]) => [x, y + ext])));
    let prev = null;
    for (let i = 0; i < n; i++) {
      const ci = [c[0], c[1] + i * step, c[2]];
      let clip = null;
      if (prev) { clip = new Path2D(); clip.rect(-10, -10, W + 20, H + 20); clip.addPath(prev.out); clip.addPath(prev.rimE); }
      prev = bowlOne(g, e, ci, r, h, L, n > 1 ? { ...o, dim: o.dim ?? .45 } : o, clip, i === n - 1, ext, o.rimW ?? (n > 1 ? RIM_W.stack : RIM_W.one));
    }
    PROJ = prevProj;
  });
  PROJ = prevProj;
}

// ———————————— 面盆（铝） ————————————
// o = { c, d 口径, flip:true 倒扣（A'），light, spot, shutter, swing, flour:true 盆底留粉（A） }
// o.k：整件等比缩放（合成按屏幕宽度定，§4.1 面盆宽 264 px；广角边缘被拉宽了，见 scenes basinCheat）
export function basin(g, e, o = {}) {
  const B = OBJ.basin, k = o.k || 1, c = o.c || B.c, R = (o.d || B.d) / 2 * k, hh = 0.13 * k, rb = 0.14 * k, flip = !!o.flip;
  lit(g, o, c[1] + hh, L => basinDraw(g, e, c, R, hh, rb, flip, L, o));
}
function basinDraw(g, e, c, R, hh, rb, flip, L, o) {
  const cm = C('basin', L), src = lightSrc(L, o), y0 = c[1], y1 = c[1] + hh;
  const rf = flip ? u => R + (rb - R) * u : u => rb + (R - rb) * u;      // 侧壁半径随高度
  const lipY = flip ? y0 + .006 : y1, lip = ring(c, R + .012, lipY, 64), far = ring(c, flip ? rb : rb, flip ? y1 : y0, 48);
  const so = toward([c[0], y1, c[2]], src, 13), aL = litAngle(c, src);
  // 第 5 轮（导演：倒扣的盆内外一色、比光斑还亮，像玻璃罩）：灯灭倒扣时外色 / 内色照光斑遮罩分（合成给台面那张）；
  // 背光一侧侧壁的自影（锥面法线 · 路灯方向 < 0，θ ∈ [ta, tb]）画成一道硬边暗部月牙；朝左下投一道硬影（只在光斑里）；盆底顶面用 lit 不用高光色；只留一条母线高光
  const dark = flip && L !== 'warm';
  let ta = 0, tb = 0;
  if (dark) {
    const d = [src[0] - c[0], src[1] - (y0 + hh / 2), src[2] - c[2]], dl = Math.hypot(...d), A = Math.hypot(d[0], d[2]) / dl;
    const w = Math.acos(Math.max(-1, Math.min(1, -Math.tan(Math.atan2(R - rb, hh)) * (d[1] / dl) / A))), phi = Math.atan2(d[2], d[0]);
    ta = phi + w; tb = phi + TAU - w;
    if (L === 'in') {   // 影尖反转 o.rot（合成把整件绕碗底中心转了 o.rot），落在真实屏幕方向上：朝左下、和窗棂影同向
      const pv = P(c), a = -(o.rot || 0), cs = Math.cos(a), sn = Math.sin(a);
      dropShadow(g, lip, far, src, 2.4, DROP(), 0, ([x, y]) => [pv[0] + (x - pv[0]) * cs - (y - pv[1]) * sn, pv[1] + (x - pv[0]) * sn + (y - pv[1]) * cs]);
    }
  } else castShadow(g, lip.concat(far), L, o);
  const out = poly(hull(sp(lip.concat(far))));
  cel(g, out, dark ? { f: cm.f } : { f: cm.f, s: cm.s, so });
  // 铝的硬高光：两条母线带 + 一条窄带
  g.save(); g.clip(out); g.fillStyle = cm.h;
  g.fill(genBand(c, rf, hh, aL, .1, .08, .92)); if (!dark) g.fill(genBand(c, rf, hh, aL + (aL > 4.7 ? -.32 : .32), .035, .1, .9));
  if (dark) { g.fillStyle = cm.s; g.fill(poly(sp(ring(c, R + .012, y0 + .006, 24, ta, tb).concat(ring(c, rb, y1, 24, ta, tb).reverse())))); }
  g.restore();
  if (flip) {
    // 倒扣：盆底朝上，一块亮面 + 车床旋纹
    const top = poly(sp(ring(c, rb, y1, 56)));
    cel(g, top, dark ? { f: cm.f, l: cm.l, lw: 1.8 } : { f: cm.h, s: cm.f, so: [so[0] * .7, so[1] * .7], l: cm.l, lw: 1.8 });
    line(g, sp(ring(c, rb * .62, y1, 48)), mix(cm.h, cm.l, .3), 1.2, true);
    line(g, sp(ring(c, rb * .3, y1, 32)), mix(cm.h, cm.l, .3), 1, true);
  } else {
    // 正放：看进盆里，远内壁 + 盆底；影子在靠光一侧
    const rimE = poly(sp(ring(c, R, y1, 64)));
    const si = towardH([c[0], y1, c[2]], src, 16);
    cel(g, rimE, { f: cm.f, s: cm.s, so: [-si[0] * 1.4, -si[1] * 1.4] });
    g.save(); g.clip(rimE);
    const fl = poly(sp(ring(c, rb - .006, y0 + .006, 48)));
    cel(g, fl, { f: mix(cm.f, cm.h, .5), s: cm.s, so: [-si[0], -si[1]] });
    line(g, sp(ring(c, rb * .55, y0 + .006, 40)), mix(cm.f, cm.l, .25), 1.1, true);
    if (o.flour !== false) basinFlour(g, c, rb * .92, y0 + .007, L, src);
    g.restore();
  }
  // 卷边：一圈粗口沿 + 亮线
  const lipS = sp(lip);
  line(g, lipS, cm.l, 6.5, true); line(g, lipS, cm.f, 3.6, true);
  if (dark) line(g, sp(ring(c, R + .012, lipY, 20, ta, tb)), cm.s, 3.6);   // 月牙那段卷边也在影里
  line(g, sp(ring(c, R + .012, lipY + .002, 16, dark ? Math.max(aL - .9, tb + .1) : aL - .9, aL + .5)), cm.h, 2);
  g.strokeStyle = cm.l; g.lineWidth = 2.2; g.stroke(out);
  stamp(e, out);
}

// ———————————— 擀面杖 ————————————
// 第 3 轮：直径按实物 4.5 cm（r = 2.25 cm）用 scale() 算屏幕粗细（A 约 30 px）；两端是压扁的圆头；顶上一条硬边高光，贴台面一道接触影。
// o = { at:'A'|'A2', a, b（世界，台面上两端）, r 半径（默认 0.0225）, light, spot, shutter, swing }
export function pin(g, e, o = {}) {
  const ab = (o.at === 'A2' ? OBJ.pinA2 : OBJ.pinA), rp = o.r || 0.0225;
  const a = [(o.a || ab.a)[0], TABLE.y + rp, (o.a || ab.a)[2]], b = [(o.b || ab.b)[0], TABLE.y + rp, (o.b || ab.b)[2]];
  lit(g, o, TABLE.y + rp * 2, L => pinDraw(g, e, a, b, rp, L, o));
}
// 灯灭：用灯灭色指定，再往台面的靛紫压暗、去饱和——冷画面里不能成为红沿以外的第二个暖色点
function pinColors(L) {
  // 第 5 轮（导演）：回到 §4.3 木色原值（光斑内 lit #796457、窗棂影 / 斑外 #3F3539），不再往台面靛紫压
  return C('pin', L);
}
// 屏幕上的杖身：轴两端 A、B，半径 ra、rb；两端各一个压扁的圆头（沿轴方向只有半径的 k 倍）
function capsule(A, B, ra, rb, k = .55) {
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), c = Math.cos(ang), s = Math.sin(ang), p = new Path2D();
  const A2 = [A[0] + c * ra * k, A[1] + s * ra * k], B2 = [B[0] - c * rb * k, B[1] - s * rb * k];
  p.ellipse(B2[0], B2[1], rb * k, rb, ang, -Math.PI / 2, Math.PI / 2);
  p.ellipse(A2[0], A2[1], ra * k, ra, ang, Math.PI / 2, 1.5 * Math.PI);
  p.closePath(); return p;
}
function pinDraw(g, e, a, b, rp, L, o) {
  const cp = pinColors(L), src = lightSrc(L, o);
  const d = [b[0] - a[0], 0, b[2] - a[2]], dl = Math.hypot(d[0], d[2]), u = [d[0] / dl, 0, d[2] / dl], v2 = [-u[2], 0, u[0]];
  const gen = (t, th) => [a[0] + d[0] * t + rp * (Math.sin(th) * v2[0]), a[1] + rp * Math.cos(th), a[2] + d[2] * t + rp * (Math.sin(th) * v2[2])];
  const cap = t => Array.from({ length: 20 }, (_, i) => gen(t, i / 20 * TAU));
  castShadow(g, cap(0).concat(cap(1)), L, o);
  const A = P(a), B = P(b), ra = rp * scale(...a), rb = rp * scale(...b), mid = [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2];
  const at = (t, off) => { const k = (ra + (rb - ra) * t) * off, [nx, ny] = nrm; return [A[0] + (B[0] - A[0]) * t + nx * k, A[1] + (B[1] - A[1]) * t + ny * k]; };
  // 屏幕上垂直于杖的方向，取朝光的那一侧（光在上方：顶面朝光）
  const lt = toward(mid, src, 1); let nrm = norm([-(B[1] - A[1]), B[0] - A[0]], 1); if (nrm[0] * lt[0] + nrm[1] * lt[1] < 0) nrm = [-nrm[0], -nrm[1]];
  // 接触影：杖身往背光方向错一点的暗影，只从杖下沿露出一条
  g.fillStyle = L === 'warm' ? rgba(BG.warm.woodDark, .9) : BG.dark.woodDark;
  g.fill(capsule(at(0, -.32), at(1, -.32), ra * .96, rb * .96));
  const body = capsule(A, B, ra, rb);
  cel(g, body, { f: cp.f, s: cp.s, so: [nrm[0] * ra * .78, nrm[1] * ra * .78] });
  g.save(); g.clip(body);
  // 一道木纹（背光半边）+ 顶上一条硬边高光（窄、两头圆）
  line(g, [at(.1, -.3), at(.45, -.26), at(.86, -.32)], mix(cp.f, cp.l, .3), 1.1);
  const h0 = at(.05, .5), h1 = at(.95, .5);
  g.fillStyle = cp.h; g.fill(capsule(h0, h1, ra * .17, rb * .17, 1));
  g.restore();
  g.strokeStyle = cp.l; g.lineWidth = 2.2; g.lineJoin = 'round'; g.stroke(body);
  stamp(e, body);
}

// ———————————— 围裙（A'：叠好放在原来碗摞的位置） ————————————
// 第 4 轮（评委：两个同心圆像按钮 / 旋钮，带子垂出台边像电源线，整块像钱包 / 手机套；顶面比 §4.3 光斑外 lit 亮了一档）：
// 改成一块叠好的旧灰蓝布——三层布错开：底层最大，中层往前错出几毫米，最上面折回来的一层只盖到后 2/3；朝机位露出三道布边的厚度，
// 上一层在下一层顶面上落一道硬边影。顶层一道压平的旧折痕。一根系带根部压在顶层底下、带头软软地搭在顶面上，另一根整根压在布底下（不垂出台边）。
// 灯灭时整件在光斑外：顶面 lit #2E3457、厚度边 / 影 #171933、线 #13122A（§4.3）；朝窗的后沿只留一线很暗的轮廓光，整体不比红沿显眼。
// o = { c（叠好的顶面中心，默认 OBJ.apronA2.c）, light, spot, shutter }
export function apron(g, e, o = {}) {
  const c = o.c || OBJ.apronA2.c;
  lit(g, o, c[1], L => apronDraw(g, e, c, L, o));
}
const AP = { hx: .15, hz: .1, yaw: -.05, tie: .024 };
// 每层布：[半长, 半宽, 中心偏移 x, z, 层底, 层顶（按总厚的三分之几）, 种子]
const AP_LAYERS = [[.15, .1, 0, 0, 0, 1, 3], [.146, .096, .005, -.007, 1, 2, 9], [.142, .068, -.003, .026, 2, 3, 17]];
// 叠好的布块外形：超椭圆（四角圆、四边微微鼓出来，像软布不像硬板）+ 每点一点抖动
// rag：布边参差（高频起伏 + 逐点抖动，米）
const pillow = (hx, hz, p = 5, jit = .004, seed = 0, n = 64, rag = 0) => Array.from({ length: n }, (_, i) => {
  const t = i / n * TAU, c = Math.cos(t), s = Math.sin(t), k = 1 + (jit * Math.sin(3 * t + seed) + jit * .2 * (2 * hash(seed + i * 3.1) - 1)
    + rag * (.55 * Math.sin(11 * t + seed * 1.7) + (2 * hash(seed + i * 7.7) - 1))) / Math.min(hx, hz);
  return [hx * Math.sign(c) * Math.abs(c) ** (2 / p) * k, hz * Math.sign(s) * Math.abs(s) ** (2 / p) * k];
});
function apronDraw(g, e, c, L, o) {
  // 第 5 轮（导演：720p 下还是一块黑、像钱包）：灯灭时整体明度提一档（顶面借 4 成光斑内色，厚度边从影色提到影 / lit 之间）；
  // 布边参差；顶层一个口袋（开口一道暗缝 + U 形明线）；一根系带从布底下伸出、垂过台边
  const ca0 = C('apron', L), warm = L === 'warm', y0 = TABLE.y, th = (c[1] - y0) / 3, all = new Path2D();
  const ca = warm ? ca0 : { ...ca0, f: mix(ca0.f, C('apron', 'in').f, .4), s: mix(ca0.s, ca0.f, .5) };
  const rimC = mix(ca.f, warm ? ca.h : BG.night.snowGrey, .3), dark = warm ? rgba(BG.warm.woodDark, .9) : BG.dark.woodDark;
  const Q = (x, z, y) => [c[0] + x * Math.cos(AP.yaw) - z * Math.sin(AP.yaw), y, c[2] + x * Math.sin(AP.yaw) + z * Math.cos(AP.yaw)];
  const PQ = (x, z, y) => P(Q(x, z, y));
  const strap = (pts, y, w) => { const r = ribbon(pts.map(([x, z]) => PQ(x, z, y)), () => w), n = r.length / 2;   // 平躺的带子（屏幕宽 w px），两头剪齐（尖角）
    return path(r.map((q, i) => [q[0], q[1], i === 0 || i === n - 1 || i === n || i === 2 * n - 1 ? 1 : 0])); };
  const tw = AP.tie * scale(...c);
  // 接触影：底面外扩一圈贴住台面，往机位一侧多露一点
  g.fillStyle = dark; g.fill(path(pillow(AP.hx + .01, AP.hz + .008, 5, 0).map(([x, z]) => PQ(x, z - .008, y0))));
  // 垂过台边的系带：从底层右前角底下伸出，平躺到台沿（TABLE.z0），再沿台子前脸垂下约 12 cm，带头剪齐；垂下那段是竖面，取影 / lit 之间
  if (!warm) {
    const flat = [[.06, -.06], [.078, -.105], [.092, -.15], [.1, -.188]].map(([x, z]) => Q(x, z, y0 + .002)), ex = flat.at(-1)[0];
    const hang = [[ex + .004, y0 - .004, TABLE.z0 - .003], [ex + .011, y0 - .045, TABLE.z0 - .004], [ex + .008, y0 - .085, TABLE.z0 - .004], [ex - .002, y0 - .12, TABLE.z0 - .004]];
    const rib = pts3 => { const r = ribbon(pts3.map(P), () => tw), n = r.length / 2; return path(r.map((q, i) => [q[0], q[1], i === 0 || i === n - 1 || i === n || i === 2 * n - 1 ? 1 : 0])); };
    const TF = rib(flat.concat([[ex + .002, y0 + .001, TABLE.z0]])), TH = rib([[ex + .002, y0, TABLE.z0 - .002]].concat(hang));
    g.fillStyle = dark; g.save(); g.translate(-2, 2.5); g.fill(TF); g.restore();
    cel(g, TF, { f: ca.f, l: ca.l, lw: 1.3 });
    cel(g, TH, { f: mix(ca.s, ca.f, .45), l: ca.l, lw: 1.3 });
    all.addPath(TF); all.addPath(TH);
  }
  // 三层布：厚度边（影色）→ 顶面（lit）；再把上一层的外形往机位错 5 mm 裁进这一层顶面，落一道硬边影
  const lay = AP_LAYERS.map(([hx, hz, ox, oz, a, b, sd]) => {
    const rr = pillow(hx, hz, 8, .003, sd, 96, warm ? 0 : .004), ya = y0 + th * a, yb = y0 + th * b;
    const T = path(rr.map(([x, z]) => PQ(x + ox, z + oz, yb)));
    const side = path(hull(rr.map(([x, z]) => PQ(x + ox, z + oz, yb)).concat(rr.map(([x, z]) => PQ(x * 1.012 + ox, (z < 0 ? z - .004 : z) + oz, ya)))));
    return { rr, ox, oz, ya, yb, T, side };
  });
  lay.forEach((l, i) => {
    cel(g, l.side, { f: ca.s, l: ca.l, lw: 1.5 });
    cel(g, l.T, { f: ca.f, l: ca.l, lw: 1.4 });
    const nx = lay[i + 1];
    if (nx) { g.save(); g.clip(l.T); g.fillStyle = ca.s; g.fill(path(nx.rr.map(([x, z]) => PQ(x + nx.ox, z + nx.oz - .005, l.yb)))); g.restore(); }
    all.addPath(l.side); all.addPath(l.T);
  });
  const top = lay.at(-1), yt = top.yb + .001;
  // 顶层：一道压平的旧折痕（不到头，略弯）：前侧一道硬影线、后侧贴一线亮一点的
  g.save(); g.clip(top.T);
  const cr = [[-.11, .035], [-.04, .031], [.03, .036], [.1, .033]].map(([x, z]) => [x + top.ox, z]);
  line(g, cr.map(([x, z]) => PQ(x, z, yt)), ca.s, 1.8);
  line(g, cr.map(([x, z]) => PQ(x, z + .005, yt)), mix(ca.f, rimC, .6), 1);
  // 口袋：开口一道暗缝（硬影线）+ U 形明线（短划，线色比顶面亮）
  const pk = [[.035, .012], [.035, -.03], [.042, -.036], [.108, -.036], [.114, -.03], [.114, .012]].map(([x, z]) => PQ(x + top.ox, z, yt));
  line(g, [PQ(.033 + top.ox, .014, yt), PQ(.116 + top.ox, .014, yt)], ca.s, 2.2);
  g.setLineDash([5, 3.5]); line(g, pk, mix(ca.f, rimC, .75), 1.6); g.setLineDash([]);
  g.restore();
  // 系带：根部压在顶层后沿底下，带头软软地搭在顶面上、略弯、剪齐；下面一道硬边影。另一根整根压在布底下不露
  const tieA = [[-.085, .094], [-.078, .06], [-.062, .028], [-.036, .004], [-.004, -.012], [.024, -.018]];
  g.save(); g.clip(top.T);
  g.fillStyle = ca.s; g.fill(strap(tieA.map(([x, z]) => [x + .002, z - .006]), yt, tw));
  const TA = strap(tieA, yt + .002, tw);
  cel(g, TA, { f: ca.f, l: ca.l, lw: 1.3 });
  g.restore();
  all.addPath(TA);
  // 朝窗的后沿：一线很暗的轮廓光（只沿顶层后沿和右后角）
  const back = top.rr.filter(([x, z]) => z > .045 || (x > .1 && z > 0)).sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  line(g, back.map(([x, z]) => PQ(x + top.ox, z + top.oz, yt)), rimC, 1.2);
  stamp(e, all);
}

// ———————————— 湿布弧痕（A'） ————————————
// 第 4 轮（评委：直的宽暗带 + 一条亮线，读成一根长杆的斜影）：改成真正的弧——从左下兜到右上（拱向机位，拱度 .26 m），
// 宽约 6 cm 的湿面比周围略深一档（整条同一个透明度、硬边，木纹照样透出来：湿木头就是深一档的木头），两边随布的褶不规则起伏（多频抖动 + 尖角），
// 收笔处布离开台面，湿痕断成几块越来越小的；上面 2–3 段断续的硬边冷色水光线（反路灯，只在光斑里），两头尖、宽 2–3 px。
// o = { a, b（世界）, w 宽, bulge 弧的拱度（米，正 = 拱向机位）, light, spot, shutter }
export function wipe(g, e, o = {}) {
  const W0 = OBJ.wipeA2, a = o.a || W0.a, b = o.b || W0.b, w = o.w || W0.w, bulge = o.bulge ?? .26;
  const dx = b[0] - a[0], dz = b[2] - a[2], dl = Math.hypot(dx, dz), nx = -dz / dl, nz = dx / dl;
  const m = [(a[0] + b[0]) / 2 - nx * bulge, (a[2] + b[2]) / 2 - nz * bulge];
  const at = (t, off) => {
    const x = (1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * m[0] + t * t * b[0], z = (1 - t) * (1 - t) * a[2] + 2 * t * (1 - t) * m[1] + t * t * b[2];
    const tx = 2 * (1 - t) * (m[0] - a[0]) + 2 * t * (b[0] - m[0]), tz = 2 * (1 - t) * (m[1] - a[2]) + 2 * t * (b[2] - m[1]), tl = Math.hypot(tx, tz);
    return w2s(x - tz / tl * off, TABLE.y, z + tx / tl * off);
  };
  // 带：横向 o0…o1（以带宽为单位，−.5…+.5），t0…t1；起笔钝圆（布按下去），收笔收窄；wob = 两边起伏的幅度（带宽的几分之一）
  const band = (o0, o1, t0, t1, wob, sd) => {
    const L = [], R = [], n = 90;
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, k = Math.min(1, Math.sqrt((t - t0) / .02 + .03)) * (1 - .35 * Math.max(0, (t - t0) / (t1 - t0) - .8) / .2);
      const jl = wob * (.5 * Math.sin(t * 41 + sd) + .3 * Math.sin(t * 97 + 2 * sd) + .9 * (hash(sd + i * 3.7) - .5));
      const jr = wob * (.5 * Math.sin(t * 37 + 1.7 + sd) + .3 * Math.sin(t * 89 + sd) + .9 * (hash(sd + i * 5.1) - .5));
      L.push(at(t, (o0 * k + jl) * w)); R.push(at(t, (o1 * k - jr) * w));
    }
    return poly(L.concat(R.reverse()));
  };
  const dark = o.light === 'dark' || o.light === 'in' || o.light === 'out', wood = dark ? BG.dark.woodDark : BG.warm.woodDark;
  const wet = new Path2D();
  wet.addPath(band(-.5, .5, .02, .84, .07, 3));
  for (const [o0, o1, t0, t1, sd] of [[-.44, .08, .855, .9, 31], [-.16, .32, .915, .945, 37], [.06, .34, .958, .976, 41]]) wet.addPath(band(o0, o1, t0, t1, .05, sd));   // 收笔：布离开台面，湿痕断成几块越来越小的
  g.fillStyle = rgba(wood, dark ? .3 : .22); g.fill(wet, 'nonzero');
  // 水光线：两头尖的细条（屏幕宽 wpx），顺着弧走，断成 2–3 段
  const streak = (off, t0, t1, wpx) => {
    const sp2 = []; for (let i = 0; i <= 24; i++) sp2.push(at(t0 + (t1 - t0) * i / 24, off * w));
    return path(ribbon(sp2, u => wpx * Math.sqrt(Math.sin(Math.PI * u))));
  };
  const glints = [streak(-.2, .12, .27, 2.6), streak(-.27, .36, .5, 2.2), streak(.06, .6, .71, 2.4)];
  const col = dark ? mix(LIGHT.in, BG.dark.woodIn, .2) : mix(LIGHT.warm, BG.warm.woodHalo, .3);
  if (dark) {
    const mk = o.spot !== undefined ? o.spot : spotMask(o.shutter ?? 1.85, TABLE.y);
    if (mk) { g.save(); g.clip(mk instanceof Path2D ? mk : poly(mk)); g.fillStyle = col; for (const s of glints) g.fill(s); g.restore(); }
  } else { g.fillStyle = col; for (const s of glints) g.fill(s); }
}

// ———————————— 面粉 ————————————
// 第 4 轮（评委：半透明米褐色块读成米汤 / 湿沙）：改成不透明平涂——粉面 lit #F4EBD8 + 硬边影 #9C83AB（pal flour 暖灯套），木纹不再透上来。
// 形：擀面杖周围撒开的几块不规则薄层（锯齿边 + 脱开的碎片 + 边内露木头的小洞）+ 两小撮厚粉 + 2–3 道手指抹痕（抠掉露木头，两侧推起窄粉埂）
//     + 40–80 粒 2–6 px 硬边白点；面盆里一层粉。
// 画法：每一组先画在离屏白模上（F = 粉面，S = 同形往背光方向错 1–3 px 的影），再一次着色叠到累积层：影在下、粉面在上；后画的组盖住先画的。
// 光圈内外分色：o.halo = { mask（背景板光圈的硬边遮罩 canvas）, dx（随灯摆横移 px）}：圈内 lit / 影，圈外整体压一档（lit 往影色走 4 成）——遮罩二分，不用 alpha。
let FLC = null;
function flourCanvases() {   // [S 影白模, F 粉面白模, T 着色暂存, 圈内累积, 圈外累积]
  if (!FLC) FLC = Array.from({ length: 5 }, () => canvas(W, H));
  for (const [, x] of FLC) {
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  }
  return FLC.map(([, x]) => x);
}
// 台面（高 y）上一块不规则硬边薄层：中心 (cx, cz)，沿 ang 半长 a、垂直方向半宽 b（米）；边缘低频进出 + 高频锯齿，大半是尖角（粉边是碎的，不是水渍那种圆滑边）
function flatBlob(cx, cz, a, b, ang, seed, j = .3, y = TABLE.y, n = 96) {
  const pts = [], ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const t = i / n * TAU, lo = .55 * (2 * hash(seed + Math.floor(i / 5) * 1.37) - 1) + .45 * Math.sin(3 * t + seed * .7);
    const k = 1 + j * lo + .07 * Math.sin(7 * t + seed) + (i % 2 ? 1 : -.6) * .045 * hash(seed + i * 2.9);   // 低频进出 + 中频起伏 + 一点细锯齿（不做放射状的尖刺）
    const u = Math.cos(t) * a * k, v = Math.sin(t) * b * k;
    pts.push([...P([cx + u * ca - v * sa, y, cz + u * sa + v * ca]), hash(seed + i * 4.1) < .45 ? 1 : 0]);
  }
  return { path: path(pts), ring: (t, f) => [cx + (Math.cos(t) * a * ca - Math.sin(t) * b * sa) * f, cz + (Math.cos(t) * a * sa + Math.sin(t) * b * ca) * f] };
}
// 小碎片（屏幕 px 半径 r）：硬边不规则多边形
function chip(x, y, r, seed, sq = .6) {
  const pts = []; for (let i = 0; i < 7; i++) { const t = i / 7 * TAU, k = .6 + .7 * hash(seed + i * 2.3); pts.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k * sq]); }
  return poly(pts);
}
// 手指抹痕：世界里一条弯的指路（spine 两端 + 拱度），宽 w 米；起笔圆（指肚按下），收笔变窄（抬指）
const swW = u => Math.min(1, Math.sqrt(u / .1)) * (1 - .45 * u * u);
function swipe(a, b, bulge, w) {
  const dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz), nx = -dz / dl, nz = dx / dl, sp2 = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16, k = 4 * u * (1 - u) * bulge; sp2.push(P([a[0] + dx * u + nx * k, TABLE.y, a[1] + dz * u + nz * k])); }
  const s = scale(a[0], TABLE.y, a[1]) * w;
  return { spine: sp2, shape: path(ribbon(sp2, u => s * swW(u))), w: s };
}
// o = { sheets: [[cx, cz, a, b, ang, seed, j]...] 薄层；thick 厚粉；swipes: [[a, b, bulge, w]...]；dots 白点数；box 白点撒布范围；keep(p) 过滤；
//       y 台面高；mid 光方向取样点（世界）；halo 光圈遮罩；seed }
function flourField(g, L, src, o) {
  const cf = C('flour', L), y = o.y ?? TABLE.y, R = rng(o.seed || 7071), [S, F, T, AI, AO] = flourCanvases();
  const tones = [[AI, cf.s, cf.f]];
  if (o.halo) tones.push([AO, mix(cf.s, cf.l, .35), mix(cf.f, cf.s, .4)]);
  const aw = norm(toward(o.mid || [0, y, 1], src, 1), -1);   // 背光方向（屏幕单位向量）：影往这边错
  const dd = k => [aw[0] * k, aw[1] * k];
  const put = (P2, d) => { if (d) { S.save(); S.translate(d[0], d[1]); S.fill(P2); S.restore(); } F.fill(P2); };
  const putLine = (pts, lw, d) => { if (d) line(S, pts.map(([x, yy]) => [x + d[0], yy + d[1]]), '#fff', lw); line(F, pts, '#fff', lw); };
  const hole = P2 => { for (const x of [S, F]) { x.globalCompositeOperation = 'destination-out'; x.fill(P2); x.globalCompositeOperation = 'source-over'; } };
  const flush = () => {   // 白模着色 → 叠到累积层（影在下、粉面在上），再清空白模
    for (const [A, cs, cl] of tones) for (const [src2, col] of [[S, cs], [F, cl]]) {
      T.globalCompositeOperation = 'source-over'; T.clearRect(0, 0, W, H); T.drawImage(src2.canvas, 0, 0);
      T.globalCompositeOperation = 'source-in'; T.fillStyle = col; T.fillRect(0, 0, W, H); A.drawImage(T.canvas, 0, 0);
    }
    T.globalCompositeOperation = 'source-over'; T.clearRect(0, 0, W, H);
    for (const x of [S, F]) x.clearRect(0, 0, W, H);
  };
  // 1) 薄层：锯齿边，边外脱开的碎片，边内抠几个露木头的小洞；影只错 1.5 px（薄）
  for (const [cx, cz, a, b, ang, sd, j] of o.sheets) {
    const B = flatBlob(cx, cz, a, b, ang, sd, j ?? .3, y);
    put(B.path, dd(1.5));
    for (let i = 0; i < 36; i++) {
      const t = R() * TAU, out = R() < .64, [x, z] = B.ring(t, out ? 1.05 + R() * R() * .5 : .7 + R() * .22), [sx, sy] = P([x, y, z]);
      const r = 1.4 + R() * R() * (out ? 8 : 5);
      if (out) put(chip(sx, sy, r, sd + i * 9.1), r > 3 ? dd(1.2) : null); else hole(chip(sx, sy, r, sd + i * 5.3));
    }
  }
  flush();
  // 2) 两小撮厚粉：同色，影错 3 px（读得出堆起来了）
  for (const [cx, cz, a, b, ang, sd] of o.thick || []) put(flatBlob(cx, cz, a, b, ang, sd, .34, y, 40).path, dd(3));
  flush();
  // 3) 手指抹过：累积层抠掉（露出抹净的木头），两侧推起一道窄粉埂，收笔处推起一小堆
  const SW = (o.swipes || []).map(([a, b, bulge, w]) => swipe(a, b, bulge, w));
  for (const [A] of tones) { A.globalCompositeOperation = 'destination-out'; for (const s of SW) A.fill(s.shape); A.globalCompositeOperation = 'source-over'; }
  for (const s of SW) {
    const n1 = s.spine.length - 1, side = k => s.spine.map((q, i) => {
      const p0 = s.spine[Math.max(0, i - 1)], p1 = s.spine[Math.min(n1, i + 1)], [nx, ny] = norm([-(p1[1] - p0[1]), p1[0] - p0[0]], k * s.w * .5 * swW(i / n1));
      return [q[0] + nx, q[1] + ny];
    });
    for (const k of [-1.15, 1.15]) putLine(side(k).slice(1), 2.4, dd(1.2));
    const e2 = s.spine.at(-1), e1 = s.spine.at(-3), [dx, dy] = norm([e2[0] - e1[0], e2[1] - e1[1]], s.w * .45);
    put(chip(e2[0] + dx, e2[1] + dy, s.w * .42, 77 + e2[0], .7), dd(2));
  }
  flush();
  // 4) 硬边白点：2–6 px，七成落在粉层附近，三成撒得更开；大一点的往背光一侧留 1 px 硬影
  const [bx0, bz0, bx1, bz1] = o.box;
  for (let i = 0; i < (o.dots || 0); i++) {
    const wide = R() < .3, u = R(), v = R(), cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, k = wide ? 1.35 : .95;
    const p = [cx + (u - .5) * (bx1 - bx0) * k, y, cz + (v - .5) * (bz1 - bz0) * k], r = 1 + 2 * Math.pow(R(), .7);
    if (o.keep && !o.keep(p)) continue;
    const [x, yy] = P(p), D = new Path2D(); D.ellipse(x, yy, r, r * .8, 0, 0, TAU);
    put(D, r > 2.2 ? dd(1.1) : null);
  }
  flush();
  // 合到画面：圈外色整片 → 圈内色裁进光圈硬边遮罩
  if (o.halo) {
    g.drawImage(AO.canvas, 0, 0);
    T.drawImage(AI.canvas, 0, 0); T.globalCompositeOperation = 'destination-in'; T.drawImage(o.halo.mask, o.halo.dx || 0, 0); T.globalCompositeOperation = 'source-over';
    g.drawImage(T.canvas, 0, 0);
  } else g.drawImage(AI.canvas, 0, 0);
}
// o = { light, spot, shutter, swing, seed, halo }：A 擀面杖周围（OBJ.pinA）一片撒开的粉；屏幕上大致 x 600–1250，y 760–940
export function flourScatter(g, e, o = {}) {
  const pa = OBJ.pinA, ang = Math.atan2(pa.b[2] - pa.a[2], pa.b[0] - pa.a[0]), mx = (pa.a[0] + pa.b[0]) / 2, mz = (pa.a[2] + pa.b[2]) / 2;
  lit(g, o, TABLE.y, L => flourField(g, L, lightSrc(L, o), {
    seed: o.seed || 7071, halo: o.halo, mid: [mx, TABLE.y, mz],
    sheets: [[-.02, .985, .17, .066, ang, 11], [-.33, 1.0, .12, .058, ang * .4, 37, .32], [.25, .905, .08, .034, ang * 1.4, 53, .34], [.12, .925, .055, .026, ang * .6, 61, .36]],
    thick: [[-.17, 1.0, .05, .026, ang * .7, 71], [.21, .935, .036, .02, ang, 83]],
    swipes: [[[-.44, 1.03], [-.27, .985], .012, .016], [[-.42, 1.055], [-.255, 1.01], .01, .014], [[-.13, .958], [-.01, .942], -.006, .02]],
    dots: 64, box: [-.58, .86, .46, 1.16],
    keep: p => p[2] > TABLE.z0 + .02 && p[2] < TABLE.z1 - .03,
  }));
}
// 面盆里一层粉：盆底大半铺一层，中间一小撮厚的，几粒白点（盆在光圈边上，统一用圈内色）
function basinFlour(g, c, rb, y, L, src) {
  flourField(g, L, src, {
    seed: 4401, y, mid: [c[0], y, c[2]],
    sheets: [[c[0] + .01, c[2] + .012, rb * .92, rb * .82, .4, 211, .22]],
    thick: [[c[0] - .02, c[2] + .025, rb * .36, rb * .24, .2, 223]],
    dots: 10, box: [c[0] - rb, c[2] - rb * .8, c[0] + rb, c[2] + rb * .9],
  });
}

// ———————————— S5 逆光面片（§4.4、§9；第 3 轮导演裁决重画：透过光写进发光板、灯芯 = 圆形灯泡热点 + 墨绿灯罩口暗环、薄面皮） ————————————
// pal.js 没收这几色，按 TREATMENT §4.4 原值写在这里（待并入 pal.js）：厚边琥珀棕 / 中间薄处浅金 / 离灯最近一块（发光板同形 #FFE6A0）/ 面片上的暗线。
// ring = 隔着面皮透出来的灯罩口（pal 的墨绿搪瓷灯罩往阴影色压）：导演特许的第四个色区，只此一处
const SHD = C('shade', 'warm');   // 第 5 轮起灯罩不再用墨绿实色，留着备查
// 第 5 轮：厚边提亮收窄（#D99A50，12–20 px）；灯在面皮后面 → 罩口环 = 隔着面皮的硬边透影（同手指影色），不进发光板
// 第 6 轮：灯钉在屋里（doughBacklit 的 ldy），面片举起 / 晃动时从灯前滑过；罩身梯形透影去掉（读成连着杖的柱子）
export const BACKLIT = { thick: '#D99A50', thin: '#F2C878', core: '#FFF0C0', coreE: '#FFE6A0', finger: '#8A5A30', ring: '#8A5A30' };
// S5 机位布局（13.5 s 上摇结束后；上摇过程由合成给 o.dy）。近景仰拍：杖轴 y = top，半径 r（→ y 62–108），两头各伸出面片 over px；
// 面片宽 w，从杖上垂到杖轴下 h（最低点 y ≈ 760）；两只拳头握在面片外侧 grips；lamp 灯泡（合成用 plateS5.lamp 覆盖）= 灯芯椭圆中心；
// core 灯芯椭圆半轴（约 250 × 185，微倾 tilt 弧度）；ring 灯罩口暗环外圈半轴，ringW 环宽 [上, 侧, 下]（罩身在上 → 上厚下薄）；
// px 尺寸都按 w / 1250 缩放（手部设定图里的小样张用）
export const S5 = { cx: 960, top: 85, r: 42, w: 1250, h: 675, over: 255, lamp: [914, 287], core: [126, 92], tilt: -.05, ring: [196, 144], ringW: [32, 20, 11], grips: [[260, 85], [1660, 85]] };
// 发光板写入量（导演裁决：灯芯和浅金区都按正常强度写进去，硬边靠颜色板保住，不靠压低发光）：
// 灯芯 #FFE6A0 满强度；浅金区同色 22%（薄斑 ×1.4、厚斑 ×0.7；浅金的 R 已近 1，再多 bloom 只会往柠檬黄推）；垂褶 10%；
// 厚边、杖印黑；灯罩口暗环连同内外 ringGap px 印黑（挡光，halation 才不把墨绿染成棕）；
// 面片外缘外溢：沿外轮廓一圈琥珀暖光（spill 强度、spillW 宽、spillB 模糊 px），面片印黑后只剩外面 40–80 px，过 CRT 成偏红橙的外溢晕
// 第 5 轮：灯芯进发光板降到 #FFE6A0 × .3（× .5 时成片中心仍冲成近白 #EFEAD9），颜色层灯芯往 coreE 靠 40%（CRT 会再加约 .1 的蓝）
const S5E = { core: .3, mid: .22, dim: .10, ringGap: 14, spill: .6, spillW: 64, spillB: 26, spillCol: mix(BACKLIT.thick, BG.warm.glassTint, .5) };
// 帘子外形（单位：x 按半宽 a、y 按垂长 h，原点 = 面片在杖上的中点）：两侧几乎直垂、下角往下坠一点，下沿是不规则的弧，最低点略偏中
const DRAPE = [[-1, 0], [-1.015, .2], [-1.005, .42], [-.97, .6], [-.91, .73], [-.82, .8], [-.68, .83], [-.52, .89], [-.3, .955], [-.04, 1], [.22, .975],
  [.45, .92], [.62, .865], [.76, .83], [.87, .755], [.945, .61], [.99, .43], [1.012, .21], [1, 0]];
// 擀面时留下的两道斜折痕（同一单位），很淡
const CREASE = [[[-.58, .1], [-.47, .34], [-.33, .58], [-.36, .78]], [[.28, .16], [.4, .37], [.52, .55], [.66, .66]]];
// 下摆的垂褶：折过去的那一面两层叠着、透光少 → 一条暗带；折过来的那一面绷薄 → 贴着它一窄条亮一档。[u, 往上伸多长（按垂长）, 暗带底宽 px, 往哪边弯]
// 第 5 轮：不再画半透明竖条；下缘轮廓本身在尖点之间往下坠成弧（SAG：尖点在 u0 ± n·w，弧心坠 amp px），从两个尖点往上各起一道硬边褶影
const SAG = { u0: .07, w: .51, amp: 24 };
const FOLDS = [[-.44, .2, 15, -1], [.58, .17, 13, 1]];
// 浅金区里擀得薄的地方（只留比底色亮的，硬边）：[u, v, 半宽 px, 半高 px, 种子]
const PATCH = [[-.62, .36, 64, 40, 3], [-.33, .63, 88, 50, 5], [.63, .30, 56, 72, 11]];
function crSample(P, n) {   // 开口 Catmull-Rom，每段取 n 个点
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let j = 0; j < n; j++) {
      const u = j / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (p2[k] - p0[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * u3)));
    }
  }
  out.push(P.at(-1).slice());
  return out;
}
const sharpPoly = pts => path(pts.map(q => [q[0], q[1], 1]));
// 不规则的圆块（薄厚斑用）：中心 c、半轴 rx ry、种子；平滑外形、硬边平涂
function lump(c, rx, ry, seed, n = 10) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < n; i++) { const an = (i + R() * .5) / n * TAU, f = .72 + R() * .42; pts.push([c[0] + Math.cos(an) * rx * f, c[1] + Math.sin(an) * ry * f]); }
  return path(pts);
}
// o = { t, cx, top, r, w, h, over, lamp:[x,y], core:[rx,ry], dy, dx（面片 / 杖横移）, amp（下摆晃动振幅，默认 6 px）, kick（跟随晃动加的振幅）,
//       ldy（灯的竖向位移：灯钉在屋里，只跟镜头上摇；不给 = dy，灯跟面片一起走 —— 手部设定图的小样张用）, cord: [罩口环上那点, 木珠顶]（屏幕坐标，固定） }
// 返回 { sheet: 面片 Path2D, pin: 杖 Path2D, top, bottom: x → 下沿 y, edge: 下半圈外轮廓 [[x, y, nx, ny]…]（外法线，面粉沿它撒）, core: 灯芯中心 }
export function doughBacklit(g, e, o = {}) {
  const S = { ...S5, ...o }, dy = o.dy || 0, cx = S.cx + (o.dx || 0), T = S.top + dy, a = S.w / 2, hh = S.h, r = S.r, Lx = S.lamp[0], Ly = S.lamp[1] + (o.ldy ?? dy), B = BACKLIT, k = S.w / S5.w;
  const fr = Math.floor((o.t ?? 0) * 12) % 6, ph = fr / 6 * TAU, amp = ((o.amp ?? 6) + (o.kick || 0)) * k;   // 12 fps、6 张一循环
  const sway = (u, v) => { const d = Math.max(0, v); return [amp * Math.sin(ph + u * 1.3) * d ** 1.6, amp * .5 * Math.sin(2 * ph + u * 2.1) * d * d]; };
  // —— 外轮廓：帘子底形 + 下摆晃动（越往下越大）+ 垂褶在下沿顶出的小尖和旁边的凹口 + 厚边的不规则波纹（沿外法线，杖边不起波） ——
  const foldDip = u => k * SAG.amp * Math.abs(Math.sin(Math.PI * (u - SAG.u0) / SAG.w));   // 下缘的下垂弧（尖点 = 褶顶）
  const base = crSample(DRAPE, 16).map(([u, v]) => {
    const [sx, sy] = sway(u, v), f = v > .7 ? foldDip(u) * Math.min(1, (v - .7) * 8) : 0;
    return [cx + a * u + sx, T + hh * v + sy + f, Math.max(0, v), u];
  });
  let s = 0;
  const geo = base.map((p, i) => {
    const q = base[Math.max(0, i - 1)], n2 = base[Math.min(base.length - 1, i + 1)];
    if (i) s += Math.hypot(p[0] - q[0], p[1] - q[1]);
    const [tx, ty] = norm([n2[0] - q[0], n2[1] - q[1]], 1);
    return { x: p[0], y: p[1], d: p[2], u: p[3], s: s / k, nx: -ty, ny: tx };   // n = 外法线；s 按 1250 宽的弧长算，小样张的波纹同形
  });
  const rip = q => Math.min(1, q.d * 9) * k * (3 * Math.sin(q.s / 41 + 1.3) + 2 * Math.sin(q.s / 17.5 + .4) + 1.2 * Math.sin(q.s / 9.3 + 2.2));
  const off = (q, w) => [q.x + q.nx * w, q.y + q.ny * w];
  const outer = geo.map(q => off(q, rip(q)));
  const lipY = T - r + 8 * k;   // 面片上沿藏在杖后面；杖顶上的卷边画完杖再单独画
  const topEdge = [[cx + a + 3 * k, lipY], [cx + a * .55, lipY], [cx + a * .1, lipY], [cx - a * .4, lipY], [cx - a - 3 * k, lipY]];
  const sheetP = path([...outer.map((p, i) => [p[0], p[1], i === 0 || i === outer.length - 1 ? 1 : 0]), ...topEdge.map((p, i) => [p[0], p[1], i === 0 || i === 4 ? 1 : 0])]);
  // 中间薄处（浅金）：外轮廓往里收 → 琥珀厚边只剩 35–70 px、宽窄不均（内界带一点外缘的波纹，但不跟死）；
  // 上沿：杖下面那一溜是面片搭过杖的双层，也是厚边 → 浅金的上界是一条起伏的线，离杖 20–34 px
  const bandW = q => k * (16 + 3 * Math.sin(q.s / 170 + .8) + 2 * Math.sin(q.s / 61 + 2));   // 第 5 轮：厚边 11–21 px
  const inset = geo.map(q => off(q, rip(q) * .35 - bandW(q))).filter(p => p[1] > T + r + 20 * k);
  const midTop = [];
  for (let i = 0; i <= 14; i++) midTop.push([inset.at(-1)[0] + (inset[0][0] - inset.at(-1)[0]) * i / 14, T + r + k * (18 + 3 * Math.sin(i * 1.3 + .5) + 2 * Math.sin(i * 2.9))]);
  const midP = path([...inset.map(p => [p[0], p[1], 0]), ...midTop.map((p, i) => [p[0], p[1], i === 0 || i === 14 ? 1 : 0])]);
  // 灯：灯芯 = 圆鼓的硬边正椭圆（不描边），中心在灯泡；外面隔一圈浅金是灯罩口暗环（上厚下薄）
  // 第 6 轮：灯钉在屋里 —— 灯芯和罩口环按灯的固定位置（Lx, Ly 不吃面片的 dx / dy、下摆晃）画，再裁进面片：面片一动，透光图案在面片上的位置就跟着变；
  // 罩身那块梯形透影去掉（读成一根柱子把灯和杖连在一起）。环 = 外椭圆减内椭圆（evenodd）；环里不另铺色，面片自己的浅金、薄厚斑、折痕照常透出来
  const coreP = new Path2D(); coreP.ellipse(Lx, Ly, S.core[0] * k, S.core[1] * k, S.tilt, 0, TAU);
  const [rx0, ry0] = S.ring.map(v => v * k), [wt, ws, wb] = S.ringW.map(v => v * k), icy = Ly + (wt - wb) / 2, irx = rx0 - ws, iry = ry0 - (wt + wb) / 2, ringP = new Path2D();
  ringP.ellipse(Lx, Ly, rx0, ry0, S.tilt, 0, TAU); ringP.ellipse(Lx, icy, irx, iry, S.tilt, 0, TAU);
  // 垂褶：从下沿（跟着晃）往上收成尖、略弯的一条暗带 + 旁边一窄条亮带（短一截）
  const hem = geo.filter(q => q.d > .6), folds = [], foldLit = [];
  for (const [fu, len, fw, side] of FOLDS) {
    const q = hem.reduce((m, p) => Math.abs(p.u - fu) < Math.abs(m.u - fu) ? p : m), b = off(q, rip(q) + 4 * k), vt = q.d - len;
    const [sx, sy] = sway(fu + side * .03, vt), tp = [cx + a * (fu + side * .03) + sx, T + hh * vt + sy], sp = [];
    for (let j = 0; j <= 6; j++) { const t = j / 6; sp.push([b[0] + (tp[0] - b[0]) * t + side * 12 * k * Math.sin(Math.PI * t), b[1] + (tp[1] - b[1]) * t]); }
    folds.push(sharpPoly(ribbon(sp, t => fw * k * (1 - t) ** .7)));
    foldLit.push(sharpPoly(ribbon(sp.slice(0, 5).map(p => [p[0] + side * fw * k * .85, p[1]]), t => fw * k * .42 * (1 - t) ** .8)));
  }
  // 薄厚斑、折痕：只在浅金区里
  const patches = PATCH.map(([u, v, prx, pry, seed]) => { const [sx, sy] = sway(u, v); return lump([cx + a * u + sx, T + hh * v + sy], prx * k, pry * k, seed); });
  const creases = CREASE.map(c => { const sp = crSample(c.map(([u, v]) => [cx + a * u, T + hh * v]), 6); return sharpPoly(ribbon(sp, t => 5 * k * Math.sin(Math.PI * t) ** .7)); });
  // —— 颜色层：硬边平涂（唇 → 厚边 → 浅金 → 灯芯，外加暗环、垂褶、薄厚斑、折痕），不许渐变 ——
  g.fillStyle = B.thick; g.fill(sheetP);
  g.save(); g.clip(sheetP);
  g.fillStyle = mix(B.thick, B.finger, .4); for (const f of folds) g.fill(f);
  g.save(); g.clip(midP);
  g.fillStyle = B.thin; g.fill(midP);
  g.fillStyle = mix(B.thin, B.core, .32); for (const P2 of patches) g.fill(P2);
  g.fillStyle = mix(B.thin, B.thick, .2); for (const c of creases) g.fill(c);
  g.fillStyle = mix(B.thin, B.thick, .62); for (const f of folds) g.fill(f);
  g.restore();
  // 灯在面皮后面：罩口一圈硬边暗环透影；灯绳 2 px 同色透影从环垂到下沿（接下面露出的灯绳和木珠，同一条固定的竖线）；灯芯奶黄
  g.fillStyle = B.ring; g.fill(ringP, 'evenodd');
  if (o.cord) { g.strokeStyle = B.ring; g.lineWidth = 2; g.beginPath(); g.moveTo(...o.cord[0]); g.lineTo(...o.cord[1]); g.stroke(); }
  g.fillStyle = mix(B.core, B.coreE, .4); g.fill(coreP);
  // 杖压出的一道横向暗线（杖下沿贴着面片）
  const press = [];
  for (let i = 0; i <= 16; i++) press.push([cx - a - 20 * k + (2 * a + 40 * k) * i / 16, T + r + k * (6 + 2 * Math.sin(i * 1.9 + .3))]);
  g.fillStyle = mix(B.thick, B.finger, .6); g.fill(sharpPoly([...press, ...press.map(p => [p[0], p[1] - 12 * k]).reverse()]));
  g.restore();
  g.strokeStyle = B.finger; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke(sheetP);
  // —— 杖：横贯最上方，直径 2r（84 px），两头圆头露在拳头外；逆光暗木 + 下半背光一档 + 一道硬边木头高光 + 上沿 3 px 暖金轮廓光 ——
  const x0 = cx - a - S.over * k, x1 = cx + a + S.over * k, pc = C('pin', 'warm'), pf = mix(pc.s, SIL.s5.line, .3);
  const pinP = new Path2D(); pinP.roundRect(x0, T - r, x1 - x0, 2 * r, r);
  cel(g, pinP, { f: pf, rim: { c: SIL.s5.rim, d: [0, 3] }, l: SIL.s5.line, lw: 2 });
  g.save(); g.clip(pinP);
  g.fillStyle = mix(pf, SIL.s5.line, .35); g.fillRect(x0, T + r * .38, x1 - x0, r);
  g.fillStyle = mix(pf, pc.f, .5); g.fill(sharpPoly([[x0 + r * .55, T - r * .62], [x1 - r * .55, T - r * .62], [x1 - r * .85, T - r * .36], [x0 + r * .85, T - r * .36]]));
  g.restore();
  g.strokeStyle = SIL.s5.line; g.lineWidth = 2; g.stroke(pinP);
  // 面皮翻过杖顶的卷边：从杖后面翻上来、搭在杖顶前面一窄条（两层，厚边压一档），上沿一线逆光透亮的薄边
  const cu = [], cl = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28, x = cx - a * .99 + 2 * a * .99 * u, en = Math.sin(Math.PI * u) ** .3;
    cu.push([x, T - r - k * en * (11 + 2 * Math.sin(u * 19 + .7) + 1.5 * Math.sin(u * 47))]);
    cl.push([x, T - r + k * en * (13 + 3 * Math.sin(u * 13 + 2.1) + 2 * Math.sin(u * 31 + .3))]);
  }
  const curlP = sharpPoly([...cu, ...cl.slice().reverse()]), curlRim = sharpPoly([...cu, ...cu.map(p => [p[0], p[1] + 4 * k]).reverse()]);
  g.fillStyle = mix(B.thick, B.finger, .3); g.fill(curlP);
  g.save(); g.clip(curlP); g.fillStyle = B.thin; g.fill(curlRim); g.restore();
  g.strokeStyle = B.finger; g.lineWidth = 2; g.stroke(curlP);
  // —— 发光板：下沿和两侧一圈外溢暖光（杖轴以上不放）→ 面片整张印黑；浅金区 22%（薄处再加一档、褶影暗一档）；
  //    灯的透影连同外面 ringGap px 印黑，罩口里浅金照常；灯绳透影印黑；灯芯 #FFE6A0 × S5E.core；杖、卷边印黑 ——
  e.save(); e.beginPath(); e.rect(0, T, W, H); e.clip();
  e.filter = `blur(${S5E.spillB * k}px)`; e.strokeStyle = rgba(S5E.spillCol, S5E.spill); e.lineWidth = S5E.spillW * k; e.lineJoin = 'round'; e.stroke(sheetP); e.restore();
  stamp(e, sheetP);
  e.save(); e.clip(sheetP); e.save(); e.clip(midP);
  e.fillStyle = rgba(B.thin, S5E.mid); e.fill(midP);
  e.fillStyle = rgba(B.thin, S5E.mid * .4); for (const P2 of patches) e.fill(P2);
  for (const f of folds) { e.fillStyle = '#000'; e.fill(f); e.fillStyle = rgba(B.thin, S5E.dim); e.fill(f); }
  e.restore();
  // 罩口环连同内外 ringGap px 印黑（evenodd 一圈）；环里面保留面片自己的发光（浅金 + 薄斑）
  const gp = S5E.ringGap * k, ringG = new Path2D();
  ringG.ellipse(Lx, Ly, rx0 + gp, ry0 + gp, S.tilt, 0, TAU); ringG.ellipse(Lx, icy, Math.max(1, irx - gp), Math.max(1, iry - gp), S.tilt, 0, TAU);
  e.fillStyle = '#000'; e.fill(ringG, 'evenodd');
  if (o.cord) { e.strokeStyle = '#000'; e.lineWidth = 6; e.beginPath(); e.moveTo(...o.cord[0]); e.lineTo(...o.cord[1]); e.stroke(); }
  e.fillStyle = rgba(B.coreE, S5E.core); e.fill(coreP);
  e.restore();
  stamp(e, pinP); stamp(e, curlP);
  const bottom = x => { let best = -1; for (const p of outer) if (Math.abs(p[0] - x) < 12) best = Math.max(best, p[1]); return best < 0 ? T : best; };
  const edge = geo.filter(q => q.d > .45).map(q => { const p = off(q, rip(q)); return [p[0], p[1], q.nx, q.ny]; });
  return { sheet: sheetP, pin: pinP, top: T, bottom, edge, core: [Lx, Ly] };
}

// ———————————— 测试页 ?test=props ————————————
// t < 12：主构图 A（暖灯，2.0 s）；12–15：S5 逆光面片（13.8 s）；t ≥ 36：主构图 A'（灯灭，37.8 s）
// 背景板有就用（plates.js），没有就画一块最简的占位板，只为看道具落位
function plateFallback(g, mode) {
  const dark = mode !== 'warm', [wl, wr] = [w2s(-3, TABLE.y, WIN.z), w2s(3, TABLE.y, WIN.z)];
  g.fillStyle = dark ? BG.dark.wallFar : BG.warm.wallFar; g.fillRect(0, 0, W, H);
  g.fillStyle = dark ? BG.dark.wallNear : BG.warm.wallNear; g.fillRect(0, 0, W, wl[1]);
  const win = poly([w2s(WIN.x0, WIN.y1, WIN.z), w2s(WIN.x1, WIN.y1, WIN.z), w2s(WIN.x1, WIN.y0, WIN.z), w2s(WIN.x0, WIN.y0, WIN.z)]);
  g.fillStyle = BG.night.indigo; g.fill(win);
  const tab = poly([w2s(-3, TABLE.y, TABLE.z1), w2s(3, TABLE.y, TABLE.z1), w2s(3, TABLE.y, TABLE.z0), w2s(-3, TABLE.y, TABLE.z0)]);
  g.fillStyle = dark ? BG.dark.woodOut : BG.warm.wood; g.fill(tab);
  if (!dark) { const [hx, hy] = P(HALO.c), s = scale(...HALO.c); g.fillStyle = BG.warm.woodHalo; g.beginPath(); g.ellipse(hx, hy, HALO.r * s, HALO.r * s * .52, 0, 0, TAU); g.fill(); }
  else { g.save(); g.clip(tab); g.fillStyle = BG.dark.woodIn; g.fill(spotMask(1.85)); g.restore(); }
  g.fillStyle = dark ? BG.dark.woodDark : BG.warm.woodDark; g.fillRect(0, w2s(0, TABLE.y, TABLE.z0)[1], W, H);
}
function plate(g, e, A, mode) {
  const p = A && A.plateA;
  if (!p) return plateFallback(g, mode);
  if (mode === 'warm') { g.drawImage(p.warm.c, 0, 0); e.drawImage(p.warm.e, 0, 0); return; }
  g.drawImage(p.darkOut.c, 0, 0); e.drawImage(p.darkOut.e, 0, 0);
  g.save(); g.clip(spotMask(1.85)); g.drawImage(p.darkIn.c, 0, 0); g.restore();
}
function doughTest(g, e, t, A) {
  // 占位背景：暖暗的后厨顶 + 灯的光晕（背景板有 S5 就叠上）
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, BG.warm.woodDark); gr.addColorStop(1, BG.dark.woodDark); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  airbrush(g, S5.lamp[0], S5.lamp[1], 900, 700, BG.warm.woodHalo, .8, .9);
  if (A && A.plateS5) { g.drawImage(A.plateS5.c, 0, 0); e.drawImage(A.plateS5.e, 0, 0); }
  else airbrush(e, S5.lamp[0], S5.lamp[1], 820, 640, LIGHT.warm, .35, .9);
  doughBacklit(g, e, { t });
  const FX = A && A.mods && A.mods.fx;
  if (FX && FX.flourMotes) FX.flourMotes(g, e, t, { lamp: S5.lamp });
}
export function test(g, e, t, A) {
  if (t >= 12 && t < 15) { doughTest(g, e, t, A); return {}; }
  const warm = t < 36, FX = A && A.mods && A.mods.fx;
  plate(g, e, A, warm ? 'warm' : 'dark');
  // 有 fx 就把窗里的雪和台面雪影一起画上，看整张的样子
  if (FX && FX.snow) FX.snow(g, e, t, { layers: ['far', 'mid'], clip: FX.winPanes(1.85), lamp: FX.LAMP_WIN, grains3d: true, glass: warm });
  if (FX && FX.snowShadows && !warm) FX.snowShadows(g, t, { shutter: 1.85 });
  if (warm) {
    const swing = swingAt(t), o = { light: 'warm', swing };
    flourScatter(g, e, o);
    basin(g, e, o);
    pin(g, e, { ...o, at: 'A' });
    bowl(g, e, { ...o, at: 'A' });
    shade(g, e, o);
  } else {
    const o = { light: 'dark', shutter: 1.85 }, u = Math.max(0, t - 36.875);
    wipe(g, e, o);
    basin(g, e, { ...o, flip: true });
    pin(g, e, { ...o, at: 'A2' });
    bowl(g, e, { ...o, at: 'A2' });
    apron(g, e, o);
    shade(g, e, { light: 'dark', cordSwing: 5 * Math.exp(-u * .6) * Math.sin(u / 0.75 * Math.PI) });
  }
  return {};
}
