// 《违背的青春》MV 第 6 版（v3）：黑板粉笔画。镜头表见 ../SHOTBOOK.md（S01–S28）。window.renderAt(t)。
// v3 按第二轮评委：去掉一帧跳变（姿势一律连续过渡）、道具长在手上、真的跳格、车原地变色、副歌提亮画满、少年在拍点落地亮相。
import { clamp, lerp } from '/core/lib.js';
import { Stroke, line, curve, arc, rng, n1 } from './chalk.js';
import { renderFrame, drawSlate, cam, applyCam, characterLayers, W, H } from './main.js';
import { drawFox, paint, gapLine, chalkLine, TEX, HEADS, BODY, PAL } from './puppet.js';
import { WORLD, WIPES, COL, add, grid, floorGrid, bike, star, waves, digit, hopscotch, crowd, desk, chair, bakeAll, drawWorld } from './world.js';

const SONG = await (await fetch('song.json')).json();
const BEATS = SONG.beats, BT = BEATS[1] - BEATS[0];
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ss((t - a) / (b - a));
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
const mixP = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
const blink = (t, times) => times.some((b) => t >= b && t < b + 0.14);
const SB = (x) => BEATS.reduce((b, y) => (Math.abs(y - x) < Math.abs(b - x) ? y : b), BEATS[0]);
// 平滑：对一个随时间变化的量取过去 win 秒的平均（消除一帧跳变）
const smoothed = (fn, t, win = 0.3, n = 8) => { let s = 0; for (let i = 0; i < n; i++) s += fn(t - (win * i) / (n - 1)); return s / n; };

// ================= 世界布局 =================
const A1 = { cell: 230 };
add(grid(-3200, -1500, 49, 9, 130, 'grey', 3.5), 0.6, 9.4, { group: 'cal' });
add(floorGrid(-3200, 3600, 0, 300, A1.cell, [200, -1600], 'white', 4.5), 6.2, 10.6, { group: 'floor' });
// 擦不干净的那块：一格彩色跳房子残迹，里面是愿望纸条（吉他 + 星星），被灰雾盖着
const G0 = { x0: 1560, x1: 1800, y0: -4, y1: 104 };
const ghost = add([...digit(1, 1574, 14, 60, 'orange', 6), new Stroke([[G0.x0, G0.y0], [G0.x1, G0.y0], [G0.x1, G0.y1], [G0.x0, G0.y1], [G0.x0, G0.y0]], { color: COL.orange, w: 6, wob: 0.6 })], 0, 0.1, { instant: true, group: 'ghost' });
ghost.forEach((s) => (s.dim = (t) => 0.3 + 0.7 * ramp(t, 23.8, 24.9) * (1 - 0.55 * ramp(t, 26.6, 28.4))));
const wish = add([
  arc(1640, 70, 24, 0, 6.28, { color: COL.orange, w: 6 }), arc(1662, 44, 18, 0, 6.28, { color: COL.orange, w: 6 }), arc(1648, 60, 6, 0, 6.28, { color: COL.white, w: 4 }),
  line(1670, 36, 1730, -2, { color: COL.orange, w: 7 }), line(1724, -8, 1744, 4, { color: COL.orange, w: 8 }),
  line(1640, 74, 1728, 2, { color: COL.white, w: 2 }), line(1646, 78, 1732, 6, { color: COL.white, w: 2 }),
  ...star(1764, 54, 30, 'yellow', 6)], 0, 0.1, { instant: true, group: 'wish' });
wish.forEach((s) => (s.dim = (t) => 0.1 + 0.9 * ramp(t, 24.0, 25.1) * (1 - 0.6 * ramp(t, 26.6, 28.4))));
const ghostHaze = (t) => 0.9 * (1 - 0.88 * ramp(t, 23.8, 25.1));
// 一样的白自行车 / 闪回时原地变彩色（大号，挡在他前面）
const BS = 1.5, bikesW = [], bikesC = [];
for (let i = 0; i < 14; i++) bikesW.push(add(bike(0, 0, BS, 'white', 6), 0, 0.1, { instant: true, group: 'bikeW' }));
['red', 'blue', 'yellow', 'green', 'orange', 'pink'].forEach((c) => bikesC.push(add(bike(0, 0, BS, c, 7), 0, 0.1, { instant: true, group: 'bikeC' })));
// 大人站的位置（S09 之后）和门（他用粉笔头一笔笔画出来）
const XA = 2450, DL = 2570, DR = 2730, DH = 700;
const doorS = [new Stroke([[DL, 0], [DL, -DH * 0.5], [DL, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DL, -DH], [(DL + DR) / 2, -DH - 6], [DR, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DR, -DH], [DR, -DH * 0.5], [DR, 0]], { color: COL.orange, w: 8, wob: 0.8 }), arc(DR - 30, -DH * 0.47, 8, 0, 6.28, { color: COL.orange, w: 6 })];
[[68.6, 69.3], [69.35, 69.95], [70.0, 70.65], [70.7, 70.88]].forEach(([a, b], i) => { const s = doorS[i]; s.t0 = a; s.t1 = b; s.group = 'door'; s.hide = 1e9; WORLD.push(s); });
[73.0, 73.71, 74.43, 75.14].forEach((t0, k) => WIPES.push({ t0, t1: t0 + 0.35, path: [[DL - 60 - k * 230, 60], [DL - 60 - (k + 1) * 230, 160]], w: 260, soft: 18, haze: 0 }));
// 回忆（彩）：x 9000..15000，地面 y = 90。半块黑板画满彩色：彩虹、星星、花、彩色自行车、跳房子
const A2 = { cx: 12000 }, GY = 90;
const REV = { t0: 76.97, span: 0.75, x0: A2.cx - 2600, x1: A2.cx + 2600 };
const revX = (t) => lerp(REV.x0, REV.x1, clamp((t - REV.t0) / REV.span));
const past = [];
past.push(...hopscotch(A2.cx - 620, 70, 190));
['red', 'blue', 'yellow', 'green', 'orange'].forEach((c, i) => past.push(...bike(A2.cx - 1750 + i * 300 + (i > 2 ? 2000 : 0), -20, 1.05, c, 6)));
for (let i = 0; i < 24; i++) { const R = rng(i + 3); past.push(...star(A2.cx - 2300 + R() * 4600, -1250 + R() * 700, 24 + R() * 34, ['yellow', 'orange', 'pink', 'blue', 'green'][i % 5], 5)); }
for (let i = 0; i < 6; i++) { const fx = A2.cx - 1400 + i * 520 + (i > 2 ? 400 : 0), fy = 40; for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; past.push(arc(fx + Math.cos(a) * 16, fy - 60 + Math.sin(a) * 16, 12, 0, 6.28, { color: COL[['pink', 'yellow', 'red', 'orange', 'blue', 'pink'][i]], w: 5 })); } past.push(line(fx, fy - 44, fx, fy + 10, { color: COL.green, w: 5 })); }
past.forEach((s) => { const sx = Math.min(...s.pts.map((p) => p[0])); s.t0 = REV.t0 + REV.span * clamp((sx - REV.x0) / (REV.x1 - REV.x0)); s.t1 = s.t0 + 0.12; s.group = 'past'; s.hide = 1e9; WORLD.push(s); });
['red', 'yellow', 'blue'].forEach((c, k) => { const s = arc(A2.cx + 100, 250, 1900 - k * 70, Math.PI + 0.22, 2 * Math.PI - 0.22, { color: COL[c], w: 26, kind: 'side', rwob: 0.01 }); s.t0 = REV.t0 + 0.05; s.t1 = REV.t0 + REV.span + 0.05; s.o.ease = 0; s.group = 'past'; s.hide = 1e9; WORLD.push(s); });
const KX = A2.cx - 620 + 380;
const bigStar = star(KX + 170, -300, 70, 'yellow', 8), bolt = [new Stroke([[KX + 280, -420], [KX + 240, -330], [KX + 300, -330], [KX + 255, -230]], { color: COL.orange, w: 8 })];
bigStar[0].t0 = 83.3; bigStar[0].t1 = 84.6; bolt[0].t0 = 85.0; bolt[0].t1 = 85.7; [...bigStar, ...bolt].forEach((s) => { s.group = 'draw'; s.hide = 1e9; WORLD.push(s); });
// 奔跑时手划出的彩带：和手的位置是同一个函数
const TRAIL = { t0: 87.16, t1: 90.0, x0: A2.cx - 1500, speed: 900 };
const trailHand = (t) => [TRAIL.x0 + (t - TRAIL.t0) * TRAIL.speed + 150 * 1.1, GY + (-235 + Math.sin((t - TRAIL.t0) * 7) * 26) * 1.1];
{
  const pts = []; for (let t = TRAIL.t0; t <= TRAIL.t1; t += 0.03) pts.push(trailHand(t));
  ['orange', 'yellow', 'blue'].forEach((c, k) => { const s = new Stroke(pts.map(([x, y]) => [x - k * 4, y + 6 + k * 14]), { color: COL[c], w: 9 - k * 2, wob: 0.8 }); s.t0 = TRAIL.t0 + 0.02 + k * 0.03; s.t1 = TRAIL.t1 + 0.02 + k * 0.03; s.o.ease = 0; s.group = 'trail'; s.hide = 1e9; WORLD.push(s); });
}
const SPIN = { x: A2.cx + 1400 };
['orange', 'pink', 'blue', 'yellow'].forEach((c, k) => add([arc(SPIN.x, GY - 320, 230 + k * 45, k, k + Math.PI * 1.7, { color: COL[c], w: 7, ry: (230 + k * 45) * 0.55 })], 90.3 + k * 0.35, 91.6 + k * 0.35, { group: 'spin' }));
const SEA = { x0: A2.cx + 2200, x1: A2.cx + 5200, y: 120 };
add(waves(SEA.x0, SEA.x1, SEA.y, 22, 4, ['blue', 'yellow', 'red', 'orange']), 92.9, 94.0, { group: 'sea' });
add([new Stroke([[SEA.x1 - 200, SEA.y - 40], [SEA.x1 + 300, SEA.y - 60]], { color: COL.green, w: 12, kind: 'side' })], 94.0, 94.6, { group: 'shore' });
const crowdS = add(crowd(SEA.x0 + 700, -760, 9, 1.1, 'white'), 95.75, 96.9, { group: 'crowd' });
crowdS.forEach((s, k) => (s.fig = Math.floor(k / 7)));
const waveY = (x) => SEA.y + Math.sin(x / 70) * 22 - 4;
// 课桌两边（失陪）
const A3 = { cx: 25000 };
add(desk(A3.cx, 0, 520, 230, 'white', 6), 98.0, 98.4, { group: 'desk' });
const chairA = add(chair(A3.cx - 420, 0, 1.6, 'white', 6), 98.0, 98.4, { group: 'chairA' });
add(chair(A3.cx + 340, 0, 1.6, 'orange', 6), 98.0, 98.4, { group: 'chairK' });
// 一分为二的黑板：左彩右白
const SPLIT = { x: 34000 }, KX2 = SPLIT.x - 2300 + 340;
add(hopscotch(SPLIT.x - 2300, 70, 170), 109.9, 110.0, { group: 'splitL', instant: true });
add(floorGrid(SPLIT.x + 260, SPLIT.x + 4400, 0, 280, 230, [SPLIT.x + 2300, -1500], 'white', 4.5), 109.9, 110.0, { group: 'splitR', instant: true });
add(grid(SPLIT.x + 300, -1300, 31, 8, 130, 'grey', 3.5), 109.9, 110.0, { group: 'splitR', instant: true });
add([line(SPLIT.x + 260, -900, SPLIT.x + 260, 280, { color: COL.white, w: 8 })], 118.75, 119.25, { group: 'barrier' });
WIPES.push({ t0: 129.2, t1: 136.8, path: [[SPLIT.x + 4600, -650], [SPLIT.x + 3000, -500], [SPLIT.x + 1500, -300], [SPLIT.x + 330, -200]], w: 1900, soft: 60, haze: 0 });
await new Promise((r) => setTimeout(r, 0));
bakeAll();

// ================= 画东西 =================
let PROBE = false;
function fox(api, who, P) {
  const s = P.scale ?? 1, h = (who === 'kid' ? 640 : 900) * s, Q = { boil: api.boil, ...P };
  if (PROBE) { drawFox({ probe: true }, who, Q); return Q; }
  const G = characterLayers(api, [P.x - 600 * s, (P.y ?? 0) - h - 100 * s, P.x + 600 * s, (P.y ?? 0) + 130 * s]); drawFox(G, who, Q); return Q;
}
const handW = (Q, k = 'AN') => { const e = Q._out[k].e, s = Q.scale ?? 1, f = (Q.face ?? 1) * (Q.sx ?? 1); return [Q.x + f * s * e[0], (Q.y ?? 0) + s * e[1]]; };
const toLocal = (P, w) => [(w[0] - P.x) / ((P.scale ?? 1) * (P.face ?? 1)), (w[1] - (P.y ?? 0)) / (P.scale ?? 1)];
function prop(api, rect, fn) { if (PROBE) return; const G = characterLayers(api, rect); fn(G.back); G.flush(); }
const TXA = (o = {}) => ({ tex: TEX.adult, texS: 0.6, ...o });
function coinShape(L, x, y, r, flip, colored) {
  const sx = Math.max(0.07, Math.abs(Math.cos(flip))), col = colored ?? Math.cos(flip) < 0;
  for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.scale(sx, 1); }
  const circ = Array.from({ length: 28 }, (_, k) => [Math.cos((k / 28) * 6.283) * r, Math.sin((k / 28) * 6.283) * r]);
  paint(L, circ, col ? '#efc55a' : '#d9d8d0', col ? '#d4a644' : '#bdbcb4', TXA({ seed: 3, shade: 0, hl: false }));
  chalkLine(L.line, Array.from({ length: 29 }, (_, k) => [Math.cos((k / 28) * 6.283) * r * 0.8, Math.sin((k / 28) * 6.283) * r * 0.8]), col ? 'rgba(255,241,194,0.8)' : 'rgba(244,243,236,0.8)', Math.max(1.5, r * 0.05));
  if (col) { const img = HEADS.kid[1], k = (r * 1.5) / img.height; L.line.save(); L.line.beginPath(); L.line.arc(0, 0, r * 0.76, 0, 6.29); L.line.clip(); L.line.drawImage(img, (-img.width * k) / 2, -img.height * k * 0.56, img.width * k, img.height * k); L.line.restore(); }
  else for (let i = -1; i <= 1; i++) { chalkLine(L.line, [[-r * 0.52, i * r * 0.27 + r * 0.02], [r * 0.5, i * r * 0.27 - r * 0.02]], 'rgba(120,122,116,0.9)', Math.max(1.4, r * 0.05)); chalkLine(L.line, [[i * r * 0.27 - r * 0.02, -r * 0.5], [i * r * 0.27 + r * 0.02, r * 0.52]], 'rgba(120,122,116,0.9)', Math.max(1.4, r * 0.05)); }
  for (const c of [L.fill, L.line]) c.restore();
}
function drawCoin(api, x, y, r, flip, colored = null) { prop(api, [x - r * 1.4, y - r * 1.4, x + r * 1.4, y + r * 1.4], (L) => coinShape(L, x, y, r, flip, colored)); }
function boatShape(L, x, y, sc, tilt) {
  for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.rotate(tilt); c.scale(sc, sc); }
  paint(L, [[-72, -8], [72, -8], [46, 28], [-46, 28]], '#f1ece0', '#c4c0b3', TXA({ seed: 7, shade: 3 }));
  paint(L, [[-34, -8], [0, -74], [34, -8]], '#f6f2e8', '#cfcbbf', TXA({ seed: 8, shade: 2 }));
  gapLine(L.line, [[0, -72], [0, -10]], 2); gapLine(L.line, [[-60, 2], [60, 2]], 1.6);
  for (const c of [L.fill, L.line]) c.restore();
}
function drawBoat(api, x, y, sc = 1, tilt = 0) { prop(api, [x - 110 * sc, y - 110 * sc, x + 110 * sc, y + 50 * sc], (L) => boatShape(L, x, y, sc, tilt)); }
const chalkStub = (len = 40, spin = 0) => (L, hn, hf, J, o) => {
  const [jx, jy] = o.AN.j, [ex, ey] = hn; let dx = ex - jx, dy = ey - jy; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
  const a = Math.atan2(dy, dx) + 0.45 + spin, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, bx = ex + dx * 20, by = ey + dy * 20;
  paint(L, [[bx - nx * 7 - ux * 8, by - ny * 7 - uy * 8], [bx + nx * 7 - ux * 8, by + ny * 7 - uy * 8], [bx + nx * 7 + ux * len, by + ny * 7 + uy * len], [bx - nx * 7 + ux * len, by - ny * 7 + uy * len]], '#f08a3c', '#b85c22', { tex: TEX.kid, texS: 0.5, shade: 2, hl: false });
};
const coinHeld = (r, flip, colored) => (L, hn, hf, J, o) => { const [jx, jy] = o.AN.j, [ex, ey] = hn; const dx = ex - jx, dy = ey - jy, d = Math.hypot(dx, dy) || 1; coinShape(L, ex + (dx / d) * 30, ey + (dy / d) * 30 - 8, r, flip, colored); };
function drawStub(api, x, y, ang) { prop(api, [x - 50, y - 50, x + 50, y + 50], (L) => { for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.rotate(ang); } paint(L, [[-24, -9], [24, -9], [24, 9], [-24, 9]], '#f08a3c', '#b85c22', { tex: TEX.kid, texS: 0.5, shade: 2 }); for (const c of [L.fill, L.line]) c.restore(); }); }
function drawCaseProp(api, x, yBottom) { prop(api, [x - 80, yBottom - 140, x + 80, yBottom + 20], (L) => { paint(L, [[x - 58, yBottom - 84], [x + 58, yBottom - 84], [x + 58, yBottom], [x - 58, yBottom]], PAL.adult.case, PAL.adult.caseD, TXA({ seed: 61, dir: 0 })); chalkLine(L.line, [[x - 18, yBottom - 83], [x - 15, yBottom - 102], [x + 15, yBottom - 102], [x + 18, yBottom - 83]], PAL.adult.caseD, 5); }); }
function shadow(api, x, y, rx) { if (PROBE) return; const c = api.board; c.save(); applyCam(c); c.fillStyle = 'rgba(6,14,10,0.45)'; c.filter = `blur(${Math.max(1, 3 * cam.s)}px)`; c.beginPath(); c.ellipse(x, y, rx, rx * 0.28, 0, 0, 6.29); c.fill(); c.restore(); }
function eraserBand(api, x0, x1, y0, y1, a = 0.5, seed = 5) {
  if (PROBE || a <= 0.005) return;
  const c = api.board, R = rng(seed), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  c.save(); applyCam(c); c.lineCap = 'round'; c.filter = `blur(${Math.max(2, 7 * cam.s)}px)`;
  for (let i = 0; i < 46; i++) {
    const u = (R() - 0.5) * 2, v = (R() + R() + R() - 1.5) / 1.5, x = cx + u * rx * 0.7, y = cy + v * ry * 0.8, l = rx * (0.4 + R() * 0.55);
    const w = 1 - Math.min(1, Math.abs(v)) ** 2, al = a * (0.07 + R() * 0.1) * w * (1 - Math.abs(u) * 0.5);
    c.strokeStyle = `rgba(196,207,199,${al})`; c.lineWidth = ry * (0.1 + R() * 0.16);
    c.beginPath(); c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y + (R() - 0.5) * ry * 0.06); c.stroke();
  }
  c.restore();
}
function desat(api, cx, cy, r, a) { if (PROBE || a <= 0.005) return; const c = api.board; c.save(); applyCam(c); c.globalCompositeOperation = 'saturation'; const g = c.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(128,128,128,${a})`); g.addColorStop(0.65, `rgba(128,128,128,${a * 0.85})`); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(cx - r, cy - r, 2 * r, 2 * r); c.restore(); }
function dust(api, x, y, t, t0, n = 40, spread = 300, col = '230,226,212') {
  if (PROBE) return; const u = t - t0; if (u < 0 || u > 1.6) return; const c = api.board, R = rng(Math.floor(t0 * 100));
  c.save(); applyCam(c);
  for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (0.3 + R()) * spread, px = x + Math.cos(a) * sp * ss(u / 1.2), py = y + Math.sin(a) * sp * ss(u / 1.2) * 0.6 - u * 40; c.fillStyle = `rgba(${col},${0.5 * (1 - u / 1.6)})`; c.beginPath(); c.arc(px, py, 2 + R() * 4, 0, 6.29); c.fill(); }
  c.restore();
}
function headPoint(who, P, ix, iy) {
  const B = BODY[who], img = HEADS[who][0], hs = B.headH / img.height, s = P.scale ?? 1, f = (P.face ?? 1) * (P.sx ?? 1), neck = P._out.neck;
  const a = (P.headTilt ?? 0) + (P.lean ?? 0) * 0.6, qx = (ix - img.width / 2) * hs, qy = (iy - img.height) * hs;
  const X = neck[0] + B.headDX + (P.headX ?? 0) + qx * Math.cos(a) - qy * Math.sin(a), Y = neck[1] + B.headDY + (P.headY ?? 0) + qx * Math.sin(a) + qy * Math.cos(a);
  return [P.x + f * s * X, (P.y ?? 0) + s * Y];
}
function tip(strokes, t) { let last = strokes[0].pts[0]; for (const s of strokes) { if (t < s.t0) return last; if (t <= s.t1) return s.at(s.prog(t) * s.len); last = s.end; } return last; }

// ================= 动作 =================
function walk(base, x0, s, o = {}) {
  const { dir = 1, stride = 0.5, stance = 0.6, lift = 30, swing = 0.45, bob = 6, sc = 1, lean = 0.04 } = o;
  const x = x0 + dir * s, q = s / stride, feet = {}, fl = {}, tilt = {}, rel = {};
  for (const [k, off] of [['n', 0], ['f', 0.5]]) {
    const qq = q + off, c = Math.floor(qq), f = qq - c, plant = (cc) => x0 + dir * (cc - off + 0.3) * stride;
    let fx, ly = 0, tl = 0;
    if (f < stance) fx = plant(c); else { const u = (f - stance) / (1 - stance); fx = lerp(plant(c), plant(c + 1), ss(u)); ly = Math.sin(u * Math.PI) * lift; tl = -0.3 * Math.sin(u * Math.PI); }
    feet[k] = [((fx - x) * dir) / sc + (k === 'n' ? 10 : -14), 0]; fl[k] = ly / sc; tilt[k] = tl; rel[k] = (fx - x) * dir;
  }
  const ph = (q % 0.5) / 0.5;
  return { ...base, x, face: dir, scale: sc, feet, footLift: fl, footTilt: tilt, bob: -Math.abs(Math.sin(ph * Math.PI)) * bob + bob * 0.5, lean, swingN: -clamp(rel.n / stride, -1, 1) * swing, swingF: -clamp(rel.f / stride, -1, 1) * swing };
}
function hops(t, tStart, n, cell) {
  const i0 = BEATS.findIndex((b) => b >= tStart), k = (t - BEATS[i0]) / BT;
  if (k < 0) return { x: 0, lift: 0, crouch: 0, air: 0 };
  if (k >= n) return { x: n * cell, lift: 0, crouch: k - n < 0.26 ? 0.8 * Math.sin(((k - n + 0.26) / 0.26) * Math.PI) : 0, air: 0 };
  const i = Math.floor(k), f = k - i, a = clamp((f - 0.22) / 0.52);
  return { x: (i + ss(a)) * cell, lift: Math.sin(a * Math.PI) * 90, crouch: 0.7 * bump(f, 0, 0.22) + 0.8 * bump(f, 0.74, 1.0), air: Math.sin(a * Math.PI) };
}
function hopPose(base, x0, h) { return { ...base, x: x0 + h.x, y: -h.lift, face: 1, crouch: h.crouch, feet: { n: [16, 0], f: [-12, 0] }, footLift: { n: h.air * 22, f: h.air * 28 }, footTilt: { n: -0.3 * h.air, f: -0.35 * h.air }, swingN: -0.35 * h.crouch + 0.55 * h.air, swingF: 0.3 * h.crouch - 0.45 * h.air, lean: 0.06 + 0.12 * h.crouch, caseSwing: -0.35 * h.air, headY: 8 * h.crouch }; }
function camTo(x, y, s, r = 0) { cam.x = x; cam.y = y; cam.s = s; cam.r = r; }
const lerpCam = (a, b, u) => camTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), lerp(a[3] ?? 0, b[3] ?? 0, u));
const breathe = (t, k = 1) => ({ bob: Math.sin(t * 2.1) * 2.5 * k, headTilt: 0.02 * Math.sin(t * 1.3) * k });

// ================= 镜头 =================
let NIGHT = 0;
const XS4 = -1800 + 8 * A1.cell, XS5 = XS4 + 6 * A1.cell;
const KNEEL = { crouch: 2.6, lean: 1.1 };
const SHOTS = [
  [0, 5.65, (t, api) => { lerpCam([-3150, -1500, 3.2], [-2650, -1420, 2.6], ramp(t, 0.6, 5.6)); }],
  [5.65, 11.37, (t, api) => {
    lerpCam([-2600, -1400, 2.4], [-150, -520, 0.33], eio((t - 5.65) / 5.72));
    if (t > 7.6) fox(api, 'adult', walk({ expr: 0, tailPh: t * 2, tailAmp: 0.12, caseSwing: 0.12 * Math.sin(Math.min(t, 11) * 5) }, -3400, Math.min(1600, (t - 7.6) * 470), { dir: 1, stride: 300, lift: 30 }));
  }],
  [11.37, 17.09, (t, api) => {
    const h = hops(t, 11.4, 8, A1.cell), P = hopPose({ expr: 0, tailPh: t * 2, tailAmp: 0.15 + 0.25 * h.air }, -1800, h);
    if (blink(t, [16.4])) P.eyes = 2;
    fox(api, 'adult', P); lerpCam([-1250, -560, 0.55], [-760, -560, 0.55], (t - 11.37) / 5.72);
  }],
  [17.09, 22.81, (t, api) => {
    const h = hops(t, 17.1, 6, A1.cell), P = hopPose({ expr: 0, tailPh: t * 2, tailAmp: 0.12 }, XS4, h);
    fox(api, 'adult', P); camTo(P.x + 90 + 200 * ramp(t, 20.6, 22.6), -130, 1.8 + 0.15 * ramp(t, 17.1, 22.8));
  }],
  [22.81, 28.53, (t, api) => {
    const k = ramp(t, 22.9, 23.7), P = { x: XS5, face: 1, crouch: KNEEL.crouch * k, lean: KNEEL.lean * k, headTilt: 0.25 * k, expr: t > 25.2 && t < 26.6 ? 1 : 0, caseHand: 'f', tailPh: t * 1.5, tailAmp: 0.1, feet: { n: [22, 0], f: [-24, 0] } };
    const wipe = [1655 + 50 * Math.sin((t - 23.8) * 9) * bump(t, 23.8, 25.1), 36 + 8 * Math.cos((t - 23.8) * 9)];
    P.hands = { n: toLocal(P, mixP([XS5 + 120, -330], t < 25.6 ? wipe : mixP(wipe, [1650, 20], ramp(t, 25.6, 26.0)), k)) };
    if (blink(t, [27.2])) P.eyes = 2;
    fox(api, 'adult', P); camTo(XS5 + 240, -190, 1.3 + 0.12 * ramp(t, 22.8, 28.5));
    dust(api, 1680, 40, t, 23.9, 30, 120);
  }],
  [28.53, 33.54, (t, api) => {
    const P = { x: XS5, face: 1, ...KNEEL, headTilt: 0.25 + 0.04 * Math.sin(t * 0.8), expr: 0, caseHand: 'f', tailPh: t, tailAmp: 0.06, eyes: blink(t, [31.45]) ? 2 : 0, feet: { n: [22, 0], f: [-24, 0] } };
    P.hands = { n: toLocal(P, [1650, 20]) };
    const Q = fox(api, 'adult', P), e = headPoint('adult', Q, 273, 203);
    camTo(e[0] - 10, e[1] + 10, 2.9 + 0.25 * ramp(t, 28.5, 33.5));
    const a = 0.9 * ramp(t, 28.7, 29.4) * (1 - ramp(t, 31.45, 31.62));
    if (a > 0.01) prop(api, [e[0] - 40, e[1] - 40, e[0] + 40, e[1] + 40], (L) => { L.fill.save(); L.fill.globalAlpha = a; paint(L, Array.from({ length: 10 }, (_, k) => { const ang = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 8 : 19; return [e[0] + 2 + Math.cos(ang) * rr, e[1] + 6 + Math.sin(ang) * rr]; }), '#ffd45a', '#e6b445', { tex: TEX.kid, texS: 0.4, shade: 0, hl: false, rim: false }); L.fill.restore(); });
  }],
  [33.54, 39.26, (t, api) => {
    const up = ramp(t, 33.6, 34.4), back = ramp(t, 35.6, 36.8);
    const P = { x: XS5 - 40 * back, face: 1, crouch: KNEEL.crouch * (1 - up), lean: KNEEL.lean * (1 - up) - 0.12 * back, expr: t > 35.3 ? (t > 37.6 ? 2 : 4) : 0, caseHand: 'f', headTilt: -0.1 * back + 0.12 * ramp(t, 37.5, 38.5), tailPh: t * 1.5, tailAmp: 0.1 + 0.1 * back, feet: { n: [22, 0], f: [-24, 0] } };
    P.hands = { n: toLocal(P, mixP(mixP([1650, 20], [XS5 + 60, -330], up), [XS5 + 20, -430], back)) };
    fox(api, 'adult', P);
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2), tx = XS5 + side * (230 + (lane % 4) * 260) + (lane > 3 ? -side * 120 : 0), sx = XS5 + side * (3200 + lane * 300); const p = ramp(t, 33.7 + lane * 0.3, 35.4 + lane * 0.3); const bx = lerp(sx, tx, p), by = 20 + (lane % 3) * 90; B.forEach((s) => { s.move = [bx, by]; s.vis = true; s.front = true; }); });
    lerpCam([XS5 + 40, -400, 0.75], [XS5, -360, 0.45], eio((t - 33.54) / 5.72));
  }],
  [39.26, 44.98, (t, api) => {
    const v = (XA - XS5) / 5.72, bell = SB(42.12), xAt = (tt) => XS5 + (tt - 39.26) * v;
    const P = walk({ expr: 2, tailPh: t * 2, tailAmp: 0.12, caseHand: 'f' }, XS5, (t - 39.26) * v, { dir: 1, stride: 200, lift: 16, swing: 0.12, lean: 0.12 });
    const bellX = xAt(bell) + 120, bellY = -235, reach = ramp(t, bell - 0.55, bell - 0.05) * (1 - ramp(t, bell + 0.35, bell + 0.8));
    P.hands = { n: toLocal(P, mixP([P.x + 80, -300], [bellX, bellY], reach)) };
    if (t > bell) P.expr = t < bell + BT * 2 ? 1 : 2;
    fox(api, 'adult', P);
    const toC = ramp(t, bell, bell + 0.15) * (1 - ramp(t, bell + BT, bell + BT + 0.2));
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2); let bx = XS5 + side * (230 + (lane % 4) * 260) + (lane > 3 ? -side * 120 : 0) - (t - 39.26) * 30 * side, by = 20 + (lane % 3) * 90;
      if (i === 1) { bx = bellX + 88 * BS - (t - bell) * 20; by = 0; }
      const gone = ramp(t, 44.3, 44.6), wA = (i < 6 ? 1 - toC : 1) * (1 - gone);
      B.forEach((st) => { st.move = [bx, by]; st.vis = wA > 0.01; st.front = true; st.dim = () => wA; });
      if (i < 6) bikesC[i].forEach((st) => { st.move = [bx, by]; st.vis = toC > 0.01; st.front = true; st.dim = () => toC; }); });
    if (t > bell - 0.05 && t < bell + 0.5) prop(api, [bellX - 140, bellY - 140, bellX + 140, bellY + 40], (L) => { for (let k = 0; k < 3; k++) { const a = -2.3 + k * 0.6, r0 = 34 + 30 * ramp(t, bell, bell + 0.4); chalkLine(L.line, [[bellX + Math.cos(a) * r0, bellY + Math.sin(a) * r0], [bellX + Math.cos(a) * (r0 + 34), bellY + Math.sin(a) * (r0 + 34)]], `rgba(242,239,228,${1 - ramp(t, bell + 0.25, bell + 0.5)})`, 4); } });
    camTo(P.x + 60, -390, 0.85);
    dust(api, P.x, -260, t, 44.3, 100, 1000);
  }],
  [44.98, 50.70, (t, api) => {
    const take = ramp(t, 45.3, 46.4), look = ramp(t, 46.3, 47.1);
    const P = { x: XA, face: 1, caseHand: 'f', expr: look > 0.5 ? 2 : 0, headTilt: 0.1 + 0.14 * look, tailPh: t, tailAmp: 0.08, ...breathe(t), feet: { n: [22, 0], f: [-24, 0] },
      hands: { n: [lerp(40, 130, take), lerp(-420, -470, take)] }, hold: take > 0.35 ? chalkStub(40, look * 0.6 * Math.sin((t - 46.3) * 3.2)) : null };
    if (blink(t, [48.9])) P.eyes = 2;
    fox(api, 'adult', P); camTo(XA + 110, -520, 1.55 + 0.12 * ramp(t, 45, 50.7));
  }],
  [50.70, 56.42, (t, api) => {
    const reach = ramp(t, 51.1, 52.8) * (1 - ramp(t, 54.5, 55.6)), shake = bump(t, 52.8, 54.5) * 2.5 * Math.sin(t * 38);
    const P = { x: XA, face: 1, caseHand: 'f', expr: 2, headTilt: 0.12 + 0.08 * reach, lean: 0.12 * reach, tailPh: t, tailAmp: 0.06, ...breathe(t, 0.6), hold: chalkStub(40, -0.3 * reach), feet: { n: [22, 0], f: [-24, 0] } };
    P.hands = { n: toLocal(P, [lerp(XA + 130, 2596, reach) + shake, lerp(-470, -350, reach)]) };
    fox(api, 'adult', P); camTo(XA + 150, -430, 2.0 - 0.12 * ramp(t, 54.4, 56.4));
  }],
  [56.42, 62.14, (t, api) => {
    const flipT = SB(59.28), up = t - flipT, pocket = ramp(t, 56.5, 57.1) * (1 - ramp(t, 57.2, 57.9));
    const P = { x: XA, face: 1, caseHand: 'f', expr: up > 0 ? 4 : 0, headTilt: up > 0 ? -0.22 * ramp(up, 0, 0.5) : 0.1 + 0.08 * ramp(t, 57.9, 58.6), tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6), feet: { n: [22, 0], f: [-24, 0] } };
    const rest = [130, -490], flick = up > 0 && up < 0.3 ? [124, -500 + 10 * bump(up, 0, 0.3)] : rest;
    P.hands = { n: t < 57.9 ? mixP(mixP([60, -330], [40, -440], ramp(t, 56.5, 57.1)), flick, ramp(t, 57.2, 57.9)) : flick };
    if (t > 57.2 && up < 0) P.hold = coinHeld(22, 0.3, false);
    const Q = fox(api, 'adult', P), hw = handW(Q);
    const cy = up > 0 ? hw[1] - 30 - 1300 * (1 - Math.pow(1 - clamp(up / 2.4), 2)) : hw[1];
    if (up > 0) drawCoin(api, hw[0] + 26, cy, 26, up * 14, false);
    camTo(XA + 120, lerp(-450, cy + 120, ramp(t, flipT, flipT + 1.6)), 1.15);
  }],
  [62.14, 67.14, (t, api) => {
    drawCoin(api, 0, -2400, 320, (t - 62.14) * 1.55 + 1.2, null);
    camTo(0, -2400, 1.0 + 0.08 * ramp(t, 62.1, 67.1), 0.03 * Math.sin(t * 0.8));
    dust(api, 0, -2400, t, 62.2, 30, 600, '255,230,160');
  }],
  [67.14, 72.86, (t, api) => {
    const catchT = 67.6, xAt = (tt) => (tt < 69.35 ? XA : tt < 69.95 ? lerp(XA, XA + 150, ss((tt - 69.35) / 0.6)) : XA + 150) + (tt > 71.5 ? (tt - 71.5) * 210 : 0);
    const rawK = (tt) => { if (tt < 68.1) return 0; if (tt < 68.6) return ramp(tt, 68.1, 68.6); if (tt > 70.88) return 0; const p = tip(doorS, tt); return tt > 69.3 && tt < 70.0 ? 0 : 1 - clamp(-p[1] / DH); };
    const k = smoothed(rawK, t, 0.3);
    const x = xAt(t), s = x - XA;
    const P = { ...walk({}, XA, s, { dir: 1, stride: 160, lift: 18, swing: 0.15 }), caseHand: 'f', crouch: KNEEL.crouch * k, lean: 0.12 + (KNEEL.lean - 0.12) * k, headTilt: 0.1 * k - 0.06 * ramp(t, 70.9, 71.3), tailPh: t * 2, tailAmp: 0.15 };
    P.expr = t < catchT ? 4 : t < 68.2 ? 1 : t < 70.9 ? 2 : 1;
    const pocketW = [XA + 40, -440], startW = [DL, 0];
    let hand;
    if (t < catchT) hand = [XA + 130, lerp(-330, -500, ramp(t, 67.14, catchT))];
    else if (t < 68.1) hand = mixP([XA + 130, -500], pocketW, ramp(t, 67.75, 68.1));
    else if (t < 68.6) hand = mixP(pocketW, startW, ramp(t, 68.15, 68.6));
    else if (t < 70.9) hand = tip(doorS, t);
    else hand = mixP(tip(doorS, 70.9), [x + 90, -330], ramp(t, 70.9, 71.3));
    P.hands = { n: toLocal(P, hand) };
    if (t > 68.1 && t < 71.3) P.hold = chalkStub(36, 0.2);
    if (t >= catchT && t < 68.1) P.hold = coinHeld(22, Math.PI, true);
    P.ink = 1 - ramp(x, DL + 30, DR - 20);
    if (t > 70.9) prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92 * ramp(t, 70.9, 71.4); L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    fox(api, 'adult', P);
    if (t < catchT) drawCoin(api, XA + 160, lerp(-1400, -510, ramp(t, 67.14, catchT)), 26, (t - 67.14) * 12, null);
    camTo(lerp(XA + 120, (DL + DR) / 2 - 60, ramp(t, 67.6, 69.4)), lerp(-360, -400, ramp(t, 67.6, 69.4)), lerp(1.1, 0.85, ramp(t, 67.6, 69.4)));
  }],
  [72.86, 76.97, (t, api) => {
    prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92; L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    const u = Math.pow(clamp((t - 73.2) / 3.77), 2.3); lerpCam([(DL + DR) / 2 - 300, -420, 0.7], [(DL + DR) / 2, -DH / 2, 13], u);
    NIGHT = 0.3 * ramp(t, 75.5, 76.9);
  }],
  [76.97, 81.44, (t, api) => {
    const bx = revX(t), land = SB(77.86);
    eraserBand(api, bx - 520, bx + 120, -1900, 600, 1.0 * (1 - ramp(t, REV.t0 + REV.span, REV.t0 + REV.span + 0.5)), 11);
    if (bx > KX - 60) {
      const fall = clamp((t - 77.3) / (land - 77.3)), yAir = -150 * (1 - fall * fall), sq = bump(t, land, land + 0.32);
      fox(api, 'kid', { x: KX, y: GY + yAir, face: 1, expr: t < land + 0.1 ? 4 : 2, scale: 1.1, crouch: 1.1 * sq, squash: sq, lean: 0.1 * sq, hands: t < land ? { n: [90, -330], f: [-100, -320] } : { n: mixP([90, -330], [55, -150], ramp(t, land + 0.1, land + 0.4)), f: mixP([-100, -320], [-70, -150], ramp(t, land + 0.1, land + 0.4)) }, elbowN: -1, elbowF: 1, headTilt: -0.12 * ramp(t, land, land + 0.4), tailPh: t * 3, tailAmp: 0.35 + 0.3 * (1 - fall), footLift: { n: 14 * (1 - fall), f: 22 * (1 - fall) } });
    }
    lerpCam([A2.cx - 900, -380, 1.15], [A2.cx - 100, -420, 0.55], eio((t - 77.3) / 2.2));
    dust(api, bx, -600, t, 77.0, 120, 1400);
  }],
  [81.44, 87.16, (t, api) => {
    const P = { x: KX, y: GY, face: 1, scale: 1.1, expr: t < 86.1 ? 2 : 1, headTilt: -0.14 + 0.1 * ramp(t, 86.0, 86.6), tailPh: t * 3, tailAmp: 0.35, ...breathe(t, 0.7) };
    const rest = { n: [55, -150], f: [-70, -150] }, w = ramp(t, 82.95, 83.3) * (1 - ramp(t, 85.75, 86.15));
    const tipL = toLocal(P, tip([...bigStar, ...bolt], clamp(t, 83.3, 85.7)));
    P.hands = { n: mixP(rest.n, tipL, w), f: rest.f }; P.elbowN = w > 0.5 ? 1 : -1; P.elbowF = 1; P.lean = 0.08 * w;
    fox(api, 'kid', P);
    camTo(lerp(KX + 110, KX + 200, ramp(t, 81.4, 87.2)), lerp(-300, -330, ramp(t, 81.4, 87.2)), 1.05 + 0.08 * Math.sin((t - 81.44) * 0.5), 0.02 * Math.sin((t - 81.44) * 0.9));
  }],
  [87.16, 90.02, (t, api) => {
    NIGHT = 0.25; const s = (t - TRAIL.t0) * TRAIL.speed;
    const P = walk({ expr: 5, tailPh: t * 6, tailAmp: 0.5 }, TRAIL.x0, s, { dir: 1, stride: 520, stance: 0.42, lift: 70, swing: 0.25, bob: 16, lean: 0.16, sc: 1.1 });
    P.y = GY; P.hands = { n: toLocal(P, trailHand(t)) }; P.elbowN = -1;
    fox(api, 'kid', P); camTo(P.x + 140, -320, 0.85);
  }],
  [90.02, 92.88, (t, api) => {
    NIGHT = 0.25; const k = (t - 90.02) / BT, f = k - Math.floor(k), hop = Math.sin(clamp((f - 0.15) / 0.6) * Math.PI) * 50, sq = bump(f, 0.72, 1.0) + bump(f, 0, 0.15);
    const sway = Math.sin(k * Math.PI), arm = Math.sin(k * Math.PI);
    fox(api, 'kid', { x: SPIN.x + 40 * sway, y: GY - hop, face: 1, scale: 1.1, expr: 1, crouch: 0.6 * sq, squash: 0.5 * sq, lean: 0.12 * sway, headTilt: -0.1 * sway, hands: { n: [130, -380 + 80 * arm], f: [-130, -300 - 80 * arm] }, elbowN: -1, elbowF: 1, feet: { n: [20 + 10 * sway, 0], f: [-24 + 10 * sway, 0] }, footLift: { n: hop * 0.25, f: hop * 0.3 }, tailPh: t * 8, tailAmp: 0.6 });
    camTo(SPIN.x, -340 - 40 * ramp(t, 90, 92.9), 0.9 + 0.12 * ramp(t, 90, 92.9), 0.03 * Math.sin(t * 1.2));
  }],
  [92.88, 95.74, (t, api) => {
    NIGHT = 0.25; const x = SEA.x0 - 120, c = ramp(t, 94.0, 94.6), take = ramp(t, 93.0, 93.6), out = ramp(t, 93.6, 94.1), rel = SB(94.95);
    const P = { x, y: GY, face: 1, scale: 1.1, crouch: 2.4 * c, lean: 0.85 * c + 0.15 * take * (1 - out), headTilt: 0.22 * c - 0.15 * take * (1 - out), expr: t > rel ? 1 : 0, tailPh: t * 2, tailAmp: 0.25 };
    const bagL = [-70, -210], frontL = [120, -150], waterW = [x + 190, waveY(x + 190) - 30];
    let hn = mixP(mixP([60, -120], bagL, take), frontL, out);
    if (t > 94.0) hn = mixP(frontL, toLocal(P, waterW), ramp(t, 94.0, rel));
    if (t > rel) hn = mixP(toLocal(P, waterW), [90, -110], ramp(t, rel + 0.15, rel + 0.6));
    P.hands = { n: hn, f: t > 93.7 && t < rel + 0.1 ? [hn[0] - 34, hn[1] + 8] : [-40, -120] };
    if (out > 0.05 && t < rel) P.holdFront = (L, a) => boatShape(L, a[0] + 46, a[1] - 4, 0.62, 0.04 * Math.sin(t * 5));
    fox(api, 'kid', P);
    if (t >= rel) drawBoat(api, waterW[0] + 10 + (t - rel) * 30, waveY(waterW[0] + 10) - 14, 0.68, 0.06 * Math.sin(t * 5));
    camTo(x + 180, -130, 1.3);
  }],
  [95.74, 98.60, (t, api) => {
    NIGHT = 0.25; const u = clamp((t - 95.74) / 2.6), bx = lerp(SEA.x0 + 260, SEA.x1 - 160, eio(u));
    crowdS.forEach((s) => (s.move = [0, -Math.abs(Math.sin(t * 9 + s.fig * 1.3)) * 14]));
    fox(api, 'kid', { x: SEA.x0 - 120, y: GY, face: 1, scale: 1.1, crouch: 0.5, lean: 0.05, headTilt: -0.16, expr: 2, tailPh: t * 2, tailAmp: 0.3, ...breathe(t, 0.6) });
    drawBoat(api, bx, waveY(bx) - 18, 1.0, 0.1 * Math.sin(t * 4) * (1 - u));
    camTo(lerp(SEA.x0 + 900, SEA.x1 - 760, eio(u)), -330, 0.58);
  }],
  [98.60, 104.32, (t, api) => {
    NIGHT = 0.15; const up = ramp(t, SB(101.46), SB(101.46) + 0.9);
    chairA.forEach((s) => (s.move = [-150 * up, 0]));
    fox(api, 'kid', { x: A3.cx + 378, face: -1, scale: 1.05, crouch: 0.72, feet: { n: [70, 0], f: [50, 0] }, expr: up > 0.5 ? 3 : 0, headTilt: 0.04 * up, hands: { n: [130, -224], f: [100, -224] }, elbowN: 1, elbowF: 1, tailPh: t * 2, tailAmp: 0.18, ...breathe(t, 0.5) });
    const ax = A3.cx - 381 - 70 * up, P = { x: ax, face: 1, crouch: 3.0 * (1 - up), feet: { n: [lerp(130, 30, up), 0], f: [lerp(100, -30, up), 0] }, headTilt: 0.12 * up, expr: up > 0.3 ? 2 : 0, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.5) };
    P.hands = { n: toLocal(P, up > 0 ? [A3.cx - 200 - 35 * up, lerp(-340, -500, up)] : [A3.cx - 200, -340]), f: toLocal(P, [A3.cx - 250, -232]) };
    fox(api, 'adult', P);
    camTo(A3.cx, -420, 0.75 + 0.05 * ramp(t, 98.6, 104.3));
  }],
  [104.32, 110.04, (t, api) => {
    NIGHT = 0.15; const rev = t >= SB(107.18);
    const K = { x: A3.cx + 378, face: -1, scale: 1.05, crouch: 0.72, feet: { n: [70, 0], f: [50, 0] }, expr: 3, headTilt: -0.14 + 0.16 * ramp(t, 105.8, 107.0), hands: { n: mixP([130, -224], [70, -200], ramp(t, 105.8, 107)), f: [100, -224] }, elbowN: 1, elbowF: 1, tailPh: t * 2, tailAmp: 0.12, ...breathe(t, 0.8) };
    if (blink(t, [105.5, 108.6])) { K.expr = 0; K.eyes = 2; }
    const turn = ramp(t, 107.4, 108.4);
    const A = { x: A3.cx - 451, face: 1, expr: 2, ...breathe(t, 0.8), headTilt: 0.14 + 0.18 * turn, lean: 0.06 * turn, tailPh: t, tailAmp: 0.08, hands: { n: [lerp(60, 30, turn), lerp(-300, -430, turn)] } };
    fox(api, 'kid', K); fox(api, 'adult', A);
    if (!rev) camTo(A3.cx + 330, -470, 1.65 + 0.12 * ramp(t, 104.3, 107.2)); else camTo(A3.cx - 470, -720, 1.55 + 0.12 * ramp(t, 107.2, 110));
  }],
  [110.04, 115.76, (t, api) => {
    NIGHT = 0.15; const s = (t - 110.04) * 330 + Math.pow(Math.max(0, t - 112), 2) * 40, sc = lerp(1, 0.55, ramp(t, 110.5, 115.7));
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6) });
    const P = walk({ expr: 2, tailPh: t * 1.5, tailAmp: 0.1 }, SPLIT.x + 500, s, { dir: 1, stride: 330 * sc, lift: 24 * sc, sc, lean: 0.08 });
    P.y = -60 * (1 - sc); fox(api, 'adult', P);
    lerpCam([SPLIT.x - 200, -420, 0.38], [SPLIT.x + 100, -440, 0.3], eio((t - 110.04) / 5.72));
  }],
  [115.76, 118.62, (t, api) => {
    NIGHT = 0.15;
    const K = { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, ...breathe(t, 1), headTilt: -0.05 + 0.03 * ramp(t, 116, 118), tailPh: t, tailAmp: 0.08 };
    if (blink(t, [117.2])) { K.expr = 0; K.eyes = 2; }
    fox(api, 'kid', K);
    camTo(KX2 + 10, -400, 1.9 + 0.15 * ramp(t, 115.8, 118.6));
    desat(api, KX2, -260, 520, 0.75 * ramp(t, 116.0, 118.4));
    eraserBand(api, KX2 - 260, KX2 + 260, -560, -120, 0.5 * ramp(t, 116.2, 118.2), 21);
  }],
  [118.62, 122.91, (t, api) => {
    NIGHT = 0.15; const x0 = SPLIT.x + 1400, dist = 1070, run = clamp((t - 118.62) / 1.35);
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: t > 120.2 ? 4 : 3, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6) });
    drawCaseProp(api, x0 + 40, 0);
    const sRun = dist * (run < 1 ? ss(run) * 0.35 + run * 0.65 : 1);
    const P = walk({ expr: 5, tailPh: t * 5, tailAmp: 0.3, briefcase: false }, x0, sRun, { dir: -1, stride: 420, stance: 0.45, lift: 40, lean: 0.15 * (1 - ramp(t, 119.8, 120.2)) });
    if (t > 119.97) { const st = t - 119.97; P.x = x0 - dist + 22 * Math.sin(st * 18) * Math.exp(-st * 4); P.lean = -0.06; P.hands = { n: mixP([60, -330], [290 + 30 * ramp(st, 0.3, 1.5), -560], ramp(st, 0, 0.35)) }; P.elbowN = -1; }
    fox(api, 'adult', P);
    lerpCam([SPLIT.x - 450, -440, 0.42], [SPLIT.x - 150, -480, 0.5], eio((t - 118.62) / 4.3));
  }],
  [122.91, 128.63, (t, api) => {
    NIGHT = 0.15; const x = SPLIT.x + 420, kneel = ramp(t, 123.4, 124.4), put = ramp(t, 124.4, 126.0), back = ramp(t, 126.2, 127.0);
    const P = { x, face: -1, crouch: 2.4 * kneel, lean: 0.9 * kneel, ...breathe(t, 0.5), headTilt: 0.25 + 0.15 * put + 0.1 * back, expr: t > 126.6 ? 3 : 2, briefcase: false, tailPh: t, tailAmp: 0.08 };
    const lineW = [SPLIT.x + 232, 2], up = [x - 200, -470];
    const hand = t < 126.0 ? mixP(up, lineW, put) : mixP(lineW, [x - 170, -120], back);
    P.hands = { n: toLocal(P, hand) };
    if (t < 126.0) P.hold = coinHeld(24, Math.PI, true);
    fox(api, 'adult', P);
    if (t >= 126.0) { shadow(api, lineW[0], 30, 26); drawCoin(api, lineW[0], 10, 26, Math.PI, true); }
    drawCaseProp(api, SPLIT.x + 1440, 0);
    lerpCam([up[0], up[1] - 30, 2.0], [x - 160, -360, 0.9], eio((t - 122.91) / 5.7));
  }],
  [128.63, 137.21, (t, api) => {
    NIGHT = 0.15; const x = SPLIT.x + 420, wx = lerp(SPLIT.x + 4600, SPLIT.x + 330, clamp((t - 129.2) / 7.6));
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.08, ...breathe(t, 0.6) });
    fox(api, 'adult', { x, face: -1, crouch: 2.4, lean: 0.9, headTilt: 0.5, expr: 3, briefcase: false, hands: { n: toLocal({ x, face: -1 }, [x - 170, -120]) }, ink: 1 - ramp(wx, x + 700, x - 200), tailPh: t, tailAmp: 0.05 });
    shadow(api, SPLIT.x + 232, 30, 26); drawCoin(api, SPLIT.x + 232, 10, 26, Math.PI, true);
    eraserBand(api, wx - 200, wx + 600, -1300, 300, 0.9 * bump(t, 129.0, 137.0), 31);
    lerpCam([SPLIT.x + 600, -420, 0.4], [SPLIT.x - 500, -420, 0.36], eio((t - 128.63) / 8.6));
  }],
  [137.21, 147.03, (t, api) => {
    NIGHT = 0.15 + 0.35 * ramp(t, 140, 146.5);
    shadow(api, SPLIT.x + 232, 30, 26); drawCoin(api, SPLIT.x + 232, 10, 26, Math.PI, true);
    const roll = ramp(t, 139.4, 141.4); shadow(api, SPLIT.x + 300 + roll * 46, 28, 24); drawStub(api, SPLIT.x + 300 + roll * 46, 16, roll * 1.7 + 0.2);
    const K = { x: KX2, y: GY, face: 1, scale: 1.05, expr: 0, ...breathe(t, 0.8), headTilt: -0.05 + 0.08 * ramp(t, 141.6, 143), tailPh: t, tailAmp: 0.1 };
    if (blink(t, [141.4, 144.3])) K.eyes = 2;
    fox(api, 'kid', K);
    lerpCam([SPLIT.x + 260, -40, 2.4], [SPLIT.x - 850, -420, 0.3], eio((t - 137.21) / 9.6));
  }],
];

// ================= 合成 =================
const layer = { cv: new OffscreenCanvas(W, H), w: W, h: H, s: 1 }; layer.ctx = layer.cv.getContext('2d');
const dummy = new Proxy({}, { get: () => () => {}, set: () => true });
function drawWorldPass(ctx, t, view, front) {
  const moved = [];
  for (const s of WORLD) {
    const off = s.vis === false || (!!s.front) !== front;
    if (off) { s._hs = s.hide; s.hide = -1; moved.push(s); continue; }
    if (s.move && s.sprite) { s._x0 = s.sprite.x0; s._y0 = s.sprite.y0; s.sprite.x0 += s.move[0]; s.sprite.y0 += s.move[1]; moved.push(s); }
  }
  drawWorld(ctx, t, view, layer, applyCam, front);
  for (const s of moved) { if (s._hs !== undefined) { s.hide = s._hs; delete s._hs; } if (s._x0 !== undefined) { s.sprite.x0 = s._x0; s.sprite.y0 = s._y0; delete s._x0; delete s._y0; } }
}
const bikeDim = () => 1;
window.renderAt = (t) => renderFrame(t, (t, api) => {
  NIGHT = 0;
  for (const s of WORLD) { s.move = null; s.front = false; const b = s.group === 'bikeW' || s.group === 'bikeC'; s.vis = !b; if (b) s.dim = bikeDim; }
  const shot = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  PROBE = true; shot[2](t, { ...api, board: dummy }); PROBE = false;
  drawSlate(api.board);
  if (NIGHT > 0) { api.board.save(); api.board.setTransform(1, 0, 0, 1, 0, 0); api.board.fillStyle = `rgba(4,10,22,${0.42 * NIGHT})`; api.board.fillRect(0, 0, W, H); api.board.restore(); }
  layer.s = cam.s;
  const S = 1 / cam.s, view = [cam.x - (W / 2) * S - 200, cam.y - (H / 2) * S - 200, cam.x + (W / 2) * S + 200, cam.y + (H / 2) * S + 200];
  drawWorldPass(api.board, t, view, false);
  if (t < 76.97 && view[0] < G0.x1 + 300 && view[2] > G0.x0 - 300) eraserBand(api, G0.x0 - 30, G0.x1 + 30, G0.y0 - 26, G0.y1 + 26, ghostHaze(t), 7);
  shot[2](t, api);
  if (WORLD.some((s) => s.front && s.vis !== false)) drawWorldPass(api.board, t, view, true);
});
window.SHOTS = SHOTS.map((s) => [s[0], s[1]]);
window.READY = true;
