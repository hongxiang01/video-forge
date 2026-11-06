// 《违背的青春》MV 第 6 版（v2）：黑板粉笔画。镜头表见 ../SHOTBOOK.md（S01–S28）。window.renderAt(t)。
import { clamp, lerp } from '/core/lib.js';
import { Stroke, line, curve, arc, rng, n1 } from './chalk.js';
import { renderFrame, drawSlate, cam, applyCam, characterLayers, W, H } from './main.js';
import { drawFox, paint, gapLine, chalkLine, TEX, HEADS, BODY, PAL } from './puppet.js';
import { WORLD, WIPES, COL, add, grid, floorGrid, bike, star, waves, digit, hopscotch, crowd, desk, chair, bakeAll, drawWorld, makeStreak } from './world.js';

const SONG = await (await fetch('song.json')).json();
const BEATS = SONG.beats, BT = BEATS[1] - BEATS[0];
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ss((t - a) / (b - a));
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
const blink = (t, times) => times.some((b) => t >= b && t < b + 0.14);
const SB = (x) => BEATS.reduce((b, y) => (Math.abs(y - x) < Math.abs(b - x) ? y : b), BEATS[0]);

// ================= 世界布局 =================
const A1 = { cell: 230 };
add(grid(-3200, -1500, 49, 9, 130, 'grey', 3.5), 0.6, 9.4, { group: 'cal' });
add(floorGrid(-3200, 3600, 0, 300, A1.cell, [200, -1600], 'white', 4.5), 6.2, 10.6, { group: 'floor' });
// 擦不干净的那块：一格彩色跳房子残迹 + 愿望纸条（被灰雾盖着，大人蹲下擦开）
const G0 = { x0: 1640, x1: 1830, y0: 4, y1: 74 };
const ghost = add([...digit(1, 1650, 12, 54, 'orange', 6), new Stroke([[G0.x0, G0.y0], [G0.x1, G0.y0], [G0.x1, G0.y1], [G0.x0, G0.y1], [G0.x0, G0.y0]], { color: COL.orange, w: 6, wob: 0.6 })], 0, 0.1, { instant: true, group: 'ghost' });
ghost.forEach((s) => (s.dim = (t) => 0.3 + 0.7 * ramp(t, 23.8, 24.9) * (1 - 0.55 * ramp(t, 26.6, 28.4))));
const wish = add([curve([[1700, 60], [1712, 34], [1736, 38], [1738, 62], [1714, 68], [1700, 60]], { color: COL.orange, w: 5 }), line(1732, 42, 1770, 14, { color: COL.orange, w: 5 }), line(1764, 10, 1778, 20, { color: COL.orange, w: 5 }), ...star(1800, 40, 20, 'yellow', 5)], 0, 0.1, { instant: true, group: 'wish' });
wish.forEach((s) => (s.dim = (t) => 0.12 + 0.88 * ramp(t, 24.0, 25.1) * (1 - 0.6 * ramp(t, 26.6, 28.4))));
WIPES.push({ t0: -1, t1: -0.5, path: [[G0.x0 - 10, 40], [G0.x1 + 10, 40]], w: 120, soft: 30, noErase: true, haze: (t) => 0.75 * (1 - 0.85 * ramp(t, 23.8, 25.1)) });
// 一样的白自行车 / 闪回的彩色自行车（位置每帧给）
const bikesW = [], bikesC = [];
for (let i = 0; i < 14; i++) bikesW.push(add(bike(0, 0, 1.1, 'white', 5), 0, 0.1, { instant: true, group: 'bikeW' }));
['red', 'blue', 'yellow', 'green', 'orange', 'pink'].forEach((c) => bikesC.push(add(bike(0, 0, 1.1, c, 6), 0, 0.1, { instant: true, group: 'bikeC' })));
// 大人的位置（S09 之后）和门（他用粉笔头一笔笔画出来；门和少年一样高）
const XA = 2450, DL = 2570, DR = 2730, DH = 700;
const doorS = [new Stroke([[DL, 0], [DL, -DH * 0.5], [DL, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DL, -DH], [(DL + DR) / 2, -DH - 6], [DR, -DH]], { color: COL.orange, w: 8, wob: 0.8 }), new Stroke([[DR, -DH], [DR, -DH * 0.5], [DR, 0]], { color: COL.orange, w: 8, wob: 0.8 }), arc(DR - 30, -DH * 0.47, 8, 0, 6.28, { color: COL.orange, w: 6 })];
[[68.2, 69.0], [69.05, 69.75], [69.8, 70.6], [70.65, 70.85]].forEach(([a, b], i) => { const s = doorS[i]; s.t0 = a; s.t1 = b; s.group = 'door'; s.hide = 1e9; WORLD.push(s); });
// 进门后，身后的地面格子一格格被擦掉
[73.0, 73.71, 74.43, 75.14].forEach((t0, k) => WIPES.push({ t0, t1: t0 + 0.35, path: [[DL - 60 - k * 230, 60], [DL - 60 - (k + 1) * 230, 160]], w: 260, soft: 18, haze: 0 }));
// 回忆（彩）：x 9000..15000，地面 y = 90（站在跳房子里）
const A2 = { cx: 12000 }, GY = 90;
const past = [];
past.push(...hopscotch(A2.cx - 620, 70, 190));
['red', 'blue', 'yellow', 'green', 'orange'].forEach((c, i) => past.push(...bike(A2.cx - 1700 + i * 300 + (i > 2 ? 1900 : 0), -20, 1.05, c, 6)));
for (let i = 0; i < 16; i++) { const R = rng(i + 3); past.push(...star(A2.cx - 2100 + R() * 4200, -1150 + R() * 520, 26 + R() * 30, ['yellow', 'orange', 'pink', 'blue'][i % 4], 5)); }
const REV = { t0: 76.97, span: 0.75, x0: A2.cx - 2600, x1: A2.cx + 2600 };
const revX = (t) => lerp(REV.x0, REV.x1, clamp((t - REV.t0) / REV.span));
past.forEach((s) => { const sx = Math.min(...s.pts.map((p) => p[0])); s.t0 = REV.t0 + REV.span * clamp((sx - REV.x0) / (REV.x1 - REV.x0)); s.t1 = s.t0 + 0.12; s.group = 'past'; s.hide = 1e9; WORLD.push(s); });
// 少年在身边画的星星和闪电（手跟着粉笔头）
const KX = A2.cx - 620 + 380;      // 少年站在第 3 格
const bigStar = star(KX + 170, -300, 70, 'yellow', 8), bolt = [new Stroke([[KX + 280, -420], [KX + 240, -330], [KX + 300, -330], [KX + 255, -230]], { color: COL.orange, w: 8 })];
bigStar[0].t0 = 83.3; bigStar[0].t1 = 84.6; bolt[0].t0 = 85.0; bolt[0].t1 = 85.7; [...bigStar, ...bolt].forEach((s) => { s.group = 'draw'; s.hide = 1e9; WORLD.push(s); });
// 奔跑时手划出的彩带：和手的位置用同一个公式
const TRAIL = { t0: 87.16, t1: 90.0, x0: A2.cx - 1500, speed: 900 };
const trailHand = (t) => [TRAIL.x0 + (t - TRAIL.t0) * TRAIL.speed + 180 * 1.1, GY + (-290 + Math.sin((t - TRAIL.t0) * 7) * 32) * 1.1];
{
  const pts = []; for (let t = TRAIL.t0; t <= TRAIL.t1; t += 0.04) pts.push(trailHand(t));
  ['orange', 'yellow', 'blue'].forEach((c, k) => { const s = new Stroke(pts.map(([x, y]) => [x - k * 4, y + 10 + k * 15]), { color: COL[c], w: 9 - k * 2, wob: 0.8 }); s.t0 = TRAIL.t0 + 0.02 + k * 0.03; s.t1 = TRAIL.t1 + 0.02 + k * 0.03; s.o.ease = 0; s.group = 'trail'; s.hide = 1e9; WORLD.push(s); });
}
const SPIN = { x: A2.cx + 1400 };
['orange', 'pink', 'blue', 'yellow'].forEach((c, k) => add([arc(SPIN.x, GY - 320, 230 + k * 45, k, k + Math.PI * 1.7, { color: COL[c], w: 7, ry: (230 + k * 45) * 0.55 })], 90.3 + k * 0.35, 91.6 + k * 0.35, { group: 'spin' }));
const SEA = { x0: A2.cx + 2200, x1: A2.cx + 5200, y: 120 };
add(waves(SEA.x0, SEA.x1, SEA.y, 22, 4, ['blue', 'yellow', 'red', 'orange']), 92.9, 94.0, { group: 'sea' });
add([new Stroke([[SEA.x1 - 200, SEA.y - 40], [SEA.x1 + 300, SEA.y - 60]], { color: COL.green, w: 12, kind: 'side' })], 94.0, 94.6, { group: 'shore' });
add(crowd(SEA.x0 + 700, -760, 9, 1.1, 'white'), 95.75, 96.9, { group: 'crowd' });
const waveY = (x) => SEA.y + Math.sin(x / 70) * 22 - 4;
// 课桌两边（失陪）
const A3 = { cx: 25000 };
add(desk(A3.cx, 0, 520, 230, 'white', 6), 98.0, 98.4, { group: 'desk' });
const chairA = add(chair(A3.cx - 420, 0, 1.6, 'white', 6), 98.0, 98.4, { group: 'chairA' });
add(chair(A3.cx + 340, 0, 1.6, 'orange', 6), 98.0, 98.4, { group: 'chairK' });
// 一分为二的黑板：左彩右白
const SPLIT = { x: 34000 }, KX2 = SPLIT.x - 2300 + 340;
add(hopscotch(SPLIT.x - 2300, 70, 170), 109.9, 110.0, { group: 'splitL', instant: true });
add(floorGrid(SPLIT.x + 300, SPLIT.x + 4400, 0, 280, 230, [SPLIT.x + 2300, -1500], 'white', 4.5), 109.9, 110.0, { group: 'splitR', instant: true });
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
  const G = characterLayers(api, [P.x - 560 * s, (P.y ?? 0) - h - 80 * s, P.x + 560 * s, (P.y ?? 0) + 110 * s]); drawFox(G, who, Q); return Q;
}
// 一块道具：画进粉笔层（同样的颗粒、轮廓缝）
function prop(api, rect, fn) { if (PROBE) return; const G = characterLayers(api, rect); fn(G.back); G.flush(); }
const TX = (o = {}) => ({ tex: TEX.adult, texS: 0.6, ...o });
function drawCoin(api, x, y, r, flip, colored = null) {
  const sx = Math.max(0.07, Math.abs(Math.cos(flip))), col = colored ?? Math.cos(flip) < 0;
  prop(api, [x - r * 1.4, y - r * 1.4, x + r * 1.4, y + r * 1.4], (L) => {
    for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.scale(sx, 1); }
    const circ = Array.from({ length: 28 }, (_, k) => [Math.cos(k / 28 * 6.283) * r, Math.sin(k / 28 * 6.283) * r]);
    paint(L, circ, col ? '#efc55a' : '#dcdbd3', col ? '#b98d2e' : '#a5a49c', TX({ seed: 3, shade: r * 0.08, hl: true }));
    chalkLine(L.line, Array.from({ length: 29 }, (_, k) => [Math.cos(k / 28 * 6.283) * r * 0.8, Math.sin(k / 28 * 6.283) * r * 0.8]), col ? '#fff1c2' : '#f4f3ec', r * 0.06);
    if (col) { const img = HEADS.kid[1], k = (r * 1.5) / img.height; L.line.save(); L.line.beginPath(); L.line.arc(0, 0, r * 0.76, 0, 6.29); L.line.clip(); L.line.drawImage(img, (-img.width * k) / 2, -img.height * k * 0.56, img.width * k, img.height * k); L.line.restore(); }
    else for (let i = -1; i <= 1; i++) { gapLine(L.line, [[-r * 0.5, i * r * 0.28], [r * 0.5, i * r * 0.28]], r * 0.05); gapLine(L.line, [[i * r * 0.28, -r * 0.5], [i * r * 0.28, r * 0.5]], r * 0.05); }
    for (const c of [L.fill, L.line]) c.restore();
  });
}
function drawBoat(api, x, y, sc = 1, tilt = 0) {
  prop(api, [x - 110 * sc, y - 110 * sc, x + 110 * sc, y + 50 * sc], (L) => {
    for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.rotate(tilt); c.scale(sc, sc); }
    paint(L, [[-72, -8], [72, -8], [46, 28], [-46, 28]], '#f1ece0', '#c4c0b3', TX({ seed: 7, shade: 3 }));
    paint(L, [[-34, -8], [0, -74], [34, -8]], '#f6f2e8', '#cfcbbf', TX({ seed: 8, shade: 2 }));
    gapLine(L.line, [[0, -72], [0, -10]], 2); gapLine(L.line, [[-60, 2], [60, 2]], 1.6);
    for (const c of [L.fill, L.line]) c.restore();
  });
}
const chalkStub = (len = 46) => (L, hn) => { const [x, y] = hn; paint(L, [[x - 7, y - len], [x + 9, y - len + 4], [x + 9, y + 4], [x - 7, y]], '#f08a3c', '#b85c22', { tex: TEX.kid, texS: 0.5, shade: 2, hl: false }); };
function drawStub(api, x, y, ang) { prop(api, [x - 50, y - 50, x + 50, y + 50], (L) => { for (const c of [L.fill, L.line]) { c.save(); c.translate(x, y); c.rotate(ang); } paint(L, [[-24, -9], [24, -9], [24, 9], [-24, 9]], '#f08a3c', '#b85c22', { tex: TEX.kid, texS: 0.5, shade: 2 }); for (const c of [L.fill, L.line]) c.restore(); }); }
function drawCaseProp(api, x, yBottom) { prop(api, [x - 80, yBottom - 140, x + 80, yBottom + 20], (L) => { paint(L, [[x - 58, yBottom - 84], [x + 58, yBottom - 84], [x + 58, yBottom], [x - 58, yBottom]], PAL.adult.case, PAL.adult.caseD, TX({ seed: 61, dir: 0 })); chalkLine(L.line, [[x - 18, yBottom - 83], [x - 15, yBottom - 102], [x + 15, yBottom - 102], [x + 18, yBottom - 83]], PAL.adult.caseD, 5); }); }
// 板擦扫过的粉笔灰：一团软边的横向条纹（中心浓、边缘散），不是矩形
function eraserBand(api, x0, x1, y0, y1, a = 0.5, seed = 5) {
  if (PROBE || a <= 0.005) return;
  const c = api.board, R = rng(seed), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, n = 160;
  c.save(); applyCam(c); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const u = (R() - 0.5) * 2, v = (R() + R() + R() - 1.5) / 1.5, x = cx + u * rx * 0.8, y = cy + v * ry, l = rx * (0.25 + R() * 0.6);
    const w = 1 - Math.min(1, Math.abs(v)) ** 2, al = a * (0.05 + R() * 0.12) * w * (1 - Math.abs(u) * 0.5);
    c.strokeStyle = `rgba(205,214,205,${al})`; c.lineWidth = (ry * 0.02 + R() * ry * 0.05) / Math.max(0.3, Math.min(3, cam.s)) * cam.s + 2;
    c.beginPath(); c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y + (R() - 0.5) * ry * 0.04); c.stroke();
  }
  c.restore();
}
function dust(api, x, y, t, t0, n = 40, spread = 300, col = '230,226,212') {
  if (PROBE) return; const u = t - t0; if (u < 0 || u > 1.6) return; const c = api.board, R = rng(Math.floor(t0 * 100));
  c.save(); applyCam(c);
  for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (0.3 + R()) * spread, px = x + Math.cos(a) * sp * ss(u / 1.2), py = y + Math.sin(a) * sp * ss(u / 1.2) * 0.6 - u * 40; c.fillStyle = `rgba(${col},${0.5 * (1 - u / 1.6)})`; c.beginPath(); c.arc(px, py, 2 + R() * 4, 0, 6.29); c.fill(); }
  c.restore();
}
// 头像上某个像素点（如眼镜片）在世界里的位置
function headPoint(who, P, ix, iy) {
  const B = BODY[who], img = HEADS[who][0], hs = B.headH / img.height, s = P.scale ?? 1, f = (P.face ?? 1) * (P.sx ?? 1), neck = P._out.neck;
  const a = (P.headTilt ?? 0) + (P.lean ?? 0) * 0.6, qx = (ix - img.width / 2) * hs, qy = (iy - img.height) * hs;
  const X = neck[0] + B.headDX + (P.headX ?? 0) + qx * Math.cos(a) - qy * Math.sin(a), Y = neck[1] + B.headDY + (P.headY ?? 0) + qx * Math.sin(a) + qy * Math.cos(a);
  return [P.x + f * s * X, (P.y ?? 0) + s * Y];
}
// 正在写的那一笔的笔尖（手跟着它）
function tip(strokes, t) {
  let last = strokes[0].pts[0];
  for (const s of strokes) { if (t < s.t0) return last; if (t <= s.t1) return s.at(s.prog(t) * s.len); last = s.end; }
  return last;
}
const toLocal = (P, w) => [(w[0] - P.x) / ((P.scale ?? 1) * (P.face ?? 1)), (w[1] - (P.y ?? 0)) / (P.scale ?? 1)];

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
// 一拍跳一格：蓄力下蹲 → 腾空 → 落地缓冲
function hops(t, tStart, n, cell) {
  const i0 = BEATS.findIndex((b) => b >= tStart), k = (t - BEATS[i0]) / BT;
  if (k < 0) return { x: 0, lift: 0, crouch: 0.15, air: 0 };
  if (k >= n) return { x: n * cell, lift: 0, crouch: 0.15 * (1 - clamp((k - n) / 0.5)), air: 0 };
  const i = Math.floor(k), f = k - i, a = clamp((f - 0.22) / 0.56);
  return { x: (i + ss(a)) * cell, lift: Math.sin(a * Math.PI) * 46, crouch: 0.75 * bump(f, 0, 0.24) + 0.85 * bump(f, 0.76, 1.0) + 0.1, air: Math.sin(a * Math.PI) };
}
function hopPose(base, x0, h) { return { ...base, x: x0 + h.x, face: 1, lift: h.lift, crouch: h.crouch, feet: { n: [14, 0], f: [-12, 0] }, footLift: { n: h.air * 18, f: h.air * 22 }, footTilt: { n: -0.25 * h.air, f: -0.3 * h.air }, swingN: -0.3 * h.crouch + 0.5 * h.air, swingF: 0.3 * h.crouch - 0.4 * h.air, lean: 0.08 + 0.1 * h.crouch, caseSwing: -0.3 * h.air, headY: 6 * h.crouch }; }
function camTo(x, y, s, r = 0) { cam.x = x; cam.y = y; cam.s = s; cam.r = r; }
const lerpCam = (a, b, u) => camTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), lerp(a[3] ?? 0, b[3] ?? 0, u));
const breathe = (t, k = 1) => ({ bob: Math.sin(t * 2.1) * 2.5 * k, headTilt: 0.02 * Math.sin(t * 1.3) * k });

// ================= 镜头 =================
let NIGHT = 0;
const XS4 = -1800 + 8 * A1.cell, XS5 = XS4 + 6 * A1.cell;     // S03 跳 8 格、S04 跳 6 格 → 1420
const SHOTS = [
  [0, 5.65, (t, api) => { lerpCam([-3150, -1500, 3.2], [-2650, -1420, 2.6], ramp(t, 0.6, 5.6)); }],
  [5.65, 11.37, (t, api) => {   // S02 缓拉全貌；大人从画外走进格子
    lerpCam([-2600, -1400, 2.4], [-150, -520, 0.33], eio((t - 5.65) / 5.72));
    if (t > 7.6) { const P = walk({ expr: 0, tailPh: t * 2, tailAmp: 0.12, caseSwing: 0.12 * Math.sin(t * 5) }, -3400, Math.min(1600, (t - 7.6) * 470), { dir: 1, stride: 300, lift: 30 }); if (t > 7.6 + 1600 / 470) Object.assign(P, { feet: null, footLift: null, bob: 0, swingN: 0.05, swingF: -0.05 }); fox(api, 'adult', P); }
  }],
  [11.37, 17.09, (t, api) => {   // S03 一拍跳一格（规矩地跳入每格）
    const h = hops(t, 11.4, 8, A1.cell), P = hopPose({ expr: blink(t, [13.3, 16.2]) ? 6 : 0, tailPh: t * 2, tailAmp: 0.15 + 0.2 * h.air }, -1800, h);
    if (P.expr === 6) { P.expr = 0; P.eyes = 2; }
    fox(api, 'adult', P); camTo(P.x + 160, -430 - h.lift * 0.3, 0.72);
  }],
  [17.09, 22.81, (t, api) => {   // S04 脚的特写：跳到一块擦不干净的灰雾前，停下
    const h = hops(t, 17.1, 6, A1.cell), P = hopPose({ expr: 0, tailPh: t * 2, tailAmp: 0.12 }, XS4, h);
    fox(api, 'adult', P); camTo(P.x + 90 + 220 * ramp(t, 20.6, 22.6), -110, 1.85 + 0.15 * ramp(t, 17.1, 22.8));
  }],
  [22.81, 28.53, (t, api) => {   // S05 蹲下，用手擦开灰雾：下面是彩色的愿望纸条
    const k = ramp(t, 22.9, 23.7), P = { x: XS5, face: 1, crouch: 2.6 * k, lean: 1.0 * k, headTilt: 0.25 * k, expr: t > 25.2 && t < 26.6 ? 1 : 0, caseHand: 'f', tailPh: t * 1.5, tailAmp: 0.1 };
    const wipeX = 1700 + 70 * Math.sin((t - 23.8) * 10) * bump(t, 23.8, 25.1), wipeY = 34 + 8 * Math.cos((t - 23.8) * 10);
    P.hands = { n: toLocal(P, [lerp(XS5 + 120, wipeX, k), lerp(-300, wipeY, k)]) };
    if (blink(t, [27.2])) P.eyes = 2;
    fox(api, 'adult', P); camTo(XS5 + 250, -190, 1.3 + 0.12 * ramp(t, 22.8, 28.5));
    dust(api, 1730, 40, t, 23.9, 30, 120);
  }],
  [28.53, 33.54, (t, api) => {   // S06 镜片里映着那颗彩色的星，眨眼，星熄了
    const P = { x: XS5, face: 1, crouch: 2.6, lean: 1.0, headTilt: 0.25 + 0.05 * Math.sin(t * 0.8), expr: 0, caseHand: 'f', hands: null, tailPh: t, tailAmp: 0.06, eyes: blink(t, [31.45]) ? 2 : 0 };
    P.hands = { n: [260, 120] };
    const Q = fox(api, 'adult', P);
    const e = headPoint('adult', Q, 273, 203);
    camTo(e[0] - 10, e[1] + 10, 2.9 + 0.25 * ramp(t, 28.5, 33.5));
    if (t < 31.45) { const a = 0.9 * ramp(t, 28.7, 29.4); prop(api, [e[0] - 30, e[1] - 30, e[0] + 30, e[1] + 30], (L) => { L.fill.save(); L.fill.globalAlpha = a; paint(L, Array.from({ length: 10 }, (_, k) => { const ang = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 5 : 12; return [e[0] + Math.cos(ang) * rr, e[1] + 4 + Math.sin(ang) * rr]; }), '#ffd45a', '#d9a83a', { tex: TEX.kid, texS: 0.4, shade: 1, hl: false }); L.fill.restore(); }); }
  }],
  [33.54, 39.26, (t, api) => {   // S07 站起来；一模一样的白自行车涌进来，把他挡住、围住
    const up = ramp(t, 33.6, 34.4), P = { x: XS5, face: 1, crouch: 2.6 * (1 - up), lean: 1.0 * (1 - up), expr: t > 35.5 ? 2 : 0, caseHand: 'f', headTilt: 0.05 + 0.1 * ramp(t, 36, 37), tailPh: t * 1.5, tailAmp: 0.1 };
    fox(api, 'adult', P);
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2), tx = XS5 + side * (180 + (lane % 4) * 220) + (lane > 3 ? -side * 90 : 0), sx = XS5 + side * (2900 + lane * 260); const p = ramp(t, 33.7 + lane * 0.3, 35.4 + lane * 0.3); const bx = lerp(sx, tx, p), by = 30 + (lane % 3) * 85; B.forEach((s) => { s.move = [bx, by]; s.vis = true; s.front = true; }); });
    lerpCam([XS5 + 40, -380, 0.8], [XS5, -330, 0.48], eio((t - 33.54) / 5.72));
  }],
  [39.26, 44.98, (t, api) => {   // S08 在车缝里侧身挤着走；碰响车铃——闪回一拍彩色自行车
    const v = (XA - XS5) / 5.72, s = (t - 39.26) * v, bell = SB(42.12);
    const P = walk({ expr: 2, tailPh: t * 2, tailAmp: 0.12, caseHand: 'f' }, XS5, s, { dir: 1, stride: 200, lift: 16, swing: 0.12, lean: 0.12 });
    if (t > bell - 0.45 && t < bell + 0.3) { P.hands = { n: [150, -330] }; }
    fox(api, 'adult', P);
    const flash = t >= bell && t < bell + BT;
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2), bx = XS5 + side * (180 + (lane % 4) * 220) + (lane > 3 ? -side * 90 : 0) - (t - 39.26) * 30 * side, by = 30 + (lane % 3) * 85; B.forEach((st) => { st.move = [bx, by]; st.vis = !flash && t < 44.5; st.front = true; }); });
    bikesC.forEach((B, i) => { const bx = P.x - 760 + i * 290, by = 40 + (i % 2) * 80; B.forEach((st) => { st.move = [bx, by]; st.vis = flash; st.front = true; }); });
    if (t > bell - 0.1 && t < bell + 0.5) prop(api, [P.x + 60, -560, P.x + 320, -260], (L) => { for (let k = 0; k < 3; k++) { const a = -0.9 + k * 0.45; chalkLine(L.line, [[P.x + 175 + Math.cos(a) * 40, -340 + Math.sin(a) * 40], [P.x + 175 + Math.cos(a) * 80, -340 + Math.sin(a) * 80]], '#f2efe4', 4); } });
    camTo(P.x + 60, -380, 0.9);
    dust(api, P.x, -260, t, 44.45, 90, 900);
  }],
  [44.98, 50.70, (t, api) => {   // S09 从内袋摸出一截橙色粉笔头——满屏唯一的彩色
    const take = ramp(t, 45.3, 46.4), look = ramp(t, 46.3, 47.1);
    const P = { x: XA, face: 1, caseHand: 'f', expr: look > 0.5 ? 2 : 0, headTilt: 0.1 + 0.14 * look, tailPh: t, tailAmp: 0.08, ...breathe(t),
      hands: { n: [lerp(40, 120, take), lerp(-400, -470, take) + 6 * Math.sin(t * 6) * look] }, hold: take > 0.4 ? chalkStub() : null };
    if (blink(t, [48.9])) P.eyes = 2;
    fox(api, 'adult', P); camTo(XA + 100, -520, 1.55 + 0.12 * ramp(t, 45, 50.7));
  }],
  [50.70, 56.42, (t, api) => {   // S10 粉笔头凑近一条格子线，停住、手抖，又收回来
    const reach = ramp(t, 51.1, 52.8) * (1 - ramp(t, 54.5, 55.6)), shake = bump(t, 52.8, 54.5) * 3 * Math.sin(t * 38);
    const P = { x: XA, face: 1, caseHand: 'f', expr: 2, headTilt: 0.12 + 0.08 * reach, lean: 0.12 * reach, tailPh: t, tailAmp: 0.06, ...breathe(t, 0.6), hold: chalkStub() };
    P.hands = { n: toLocal(P, [lerp(XA + 120, 2632, reach) + shake, lerp(-470, -340, reach)]) };
    fox(api, 'adult', P); camTo(XA + 150, -430, 2.0 - 0.12 * ramp(t, 54.4, 56.4));
  }],
  [56.42, 62.14, (t, api) => {   // S11 仅剩的一枚硬币——拇指一弹，镜头跟着往上摇
    const flipT = SB(59.28), up = t - flipT;
    const P = { x: XA, face: 1, caseHand: 'f', expr: up > 0 ? 4 : 0, headTilt: up > 0 ? -0.2 * ramp(up, 0, 0.5) : 0.12, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6),
      hands: { n: [120 + (up > 0 && up < 0.25 ? -14 : 0), up > -0.3 ? -500 : lerp(-300, -480, ramp(t, 56.6, 57.6))] } };
    fox(api, 'adult', P);
    const hx = XA + 140, hy = -505, cy = up > 0 ? hy - 1300 * (1 - Math.pow(1 - clamp(up / 2.4), 2)) : hy - 8;
    drawCoin(api, hx, cy, 30, up > 0 ? up * 14 : 0.3, false);
    camTo(XA + 120, lerp(-450, cy + 120, ramp(t, flipT, flipT + 1.6)), 1.15);
  }],
  [62.14, 67.14, (t, api) => {   // S12 硬币在空中慢慢翻：一面是格子，一面是当年那张笑脸
    drawCoin(api, 0, -2400, 320, (t - 62.14) * 1.55 + 1.2, null);
    camTo(0, -2400, 1.0 + 0.08 * ramp(t, 62.1, 67.1), 0.03 * Math.sin(t * 0.8));
    dust(api, 0, -2400, t, 62.2, 30, 600, '255,230,160');
  }],
  [67.14, 72.86, (t, api) => {   // S13 接住硬币（笑脸朝上）、收好；用粉笔头一笔笔画出一扇门，走进去
    const catchT = 67.6;
    let P;
    if (t < 68.15) P = { x: XA, face: 1, caseHand: 'f', expr: t > 67.7 ? 1 : 4, tailPh: t, tailAmp: 0.12, hands: { n: t < catchT ? [120, lerp(-300, -500, ramp(t, 67.14, catchT))] : [lerp(120, 60, ramp(t, 67.7, 68.1)), lerp(-500, -420, ramp(t, 67.7, 68.1))] } };
    else if (t < 70.9) {
      const tp = tip(doorS, t), hgt = clamp(-tp[1] / DH);
      const ax = t < 69.0 ? XA : t < 69.8 ? lerp(XA, XA + 150, ramp(t, 69.0, 69.7)) : XA + 150;
      const k = t < 69.0 ? 1 - hgt : t < 69.8 ? 0 : 1 - hgt;
      P = { x: ax, face: 1, caseHand: 'f', expr: 2, crouch: 2.5 * k, lean: 0.15 + 0.85 * k, headTilt: 0.1 * k, tailPh: t * 2, tailAmp: 0.15, hold: chalkStub() };
      if (t > 69.0 && t < 69.8) Object.assign(P, walk({}, XA, 150 * ramp(t, 69.0, 69.7), { dir: 1, stride: 160, lift: 18 }), { expr: 2, hold: chalkStub(), caseHand: 'f', crouch: 0, lean: 0.15 });
      P.hands = { n: toLocal(P, tp) };
    } else {
      const s = Math.max(0, t - 71.4) * 260, P0 = XA + 150;
      P = t < 71.4 ? { x: P0, face: 1, caseHand: 'f', expr: 1, headTilt: -0.08, tailPh: t * 2, tailAmp: 0.2, ...breathe(t) } : walk({ expr: 1, tailPh: t * 2, tailAmp: 0.2, caseHand: 'f' }, P0, s, { dir: 1, stride: 300, lift: 28, swing: 0.4 });
      P.ink = 1 - ramp(P.x, DL + 40, DR - 10);
    }
    // 门洞里是黑的（画好以后）
    if (t > 70.9) prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92 * ramp(t, 70.9, 71.4); L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    fox(api, 'adult', P);
    if (t < 68.15) drawCoin(api, XA + 140, lerp(-1400, -505, ramp(t, 67.14, catchT)), 30, t < catchT ? (t - 67.14) * 12 : Math.PI, true);
    camTo(lerp(XA + 120, (DL + DR) / 2 - 60, ramp(t, 67.6, 69.4)), -360, lerp(1.1, 0.9, ramp(t, 67.6, 69.4)));
  }],
  [72.86, 76.97, (t, api) => {   // S14 镜头加速推进门里的黑；身后的白格子一格格被擦掉
    prop(api, [DL - 10, -DH - 10, DR + 10, 10], (L) => { L.fill.save(); L.fill.globalAlpha = 0.92; L.fill.fillStyle = '#07100c'; L.fill.fillRect(DL + 5, -DH + 5, DR - DL - 10, DH - 5); L.fill.restore(); });
    const u = Math.pow(clamp((t - 73.2) / 3.77), 2.3); lerpCam([(DL + DR) / 2 - 300, -380, 0.7], [(DL + DR) / 2, -DH / 2, 13], u);
    NIGHT = 0.35 * ramp(t, 75.5, 76.9);
  }],
  [76.97, 81.44, (t, api) => {   // S15 ★ 板擦横扫整块黑板，擦开的地方全是彩色的过去；少年叉腰站在跳房子正中
    const bx = revX(t);
    eraserBand(api, bx - 420, bx + 80, -1800, 500, 0.9 * (1 - ramp(t, REV.t0 + REV.span, REV.t0 + REV.span + 0.5)), 11);
    if (bx > KX - 40) fox(api, 'kid', { x: KX, y: GY, face: 1, expr: 2, scale: 1.1, hands: { n: [55, -150], f: [-70, -150] }, elbowN: -1, elbowF: 1, headTilt: -0.12, tailPh: t * 3, tailAmp: 0.35, ...breathe(t, 0.6) });
    lerpCam([A2.cx - 900, -380, 1.15], [A2.cx, -440, 0.42], eio((t - 77.25) / 2.1));
    dust(api, bx, -600, t, 77.0, 120, 1400);
  }],
  [81.44, 87.16, (t, api) => {   // S16 斜眼、扬眉，随手画出星星和闪电（傲慢的青春）
    const P = { x: KX, y: GY, face: 1, scale: 1.1, expr: t < 86 ? 2 : 1, headTilt: -0.14 + 0.1 * ramp(t, 85.9, 86.6), tailPh: t * 3, tailAmp: 0.35, ...breathe(t, 0.7) };
    const drawing = t > 83.1 && t < 85.9;
    if (drawing) { P.hands = { n: toLocal(P, tip([...bigStar, ...bolt], t)), f: [-70, -150] }; P.elbowN = 1; P.elbowF = 1; P.lean = 0.08; }
    else { P.hands = { n: [55, -150], f: [-70, -150] }; P.elbowN = -1; P.elbowF = 1; }
    fox(api, 'kid', P);
    camTo(lerp(KX + 110, KX + 200, ramp(t, 81.4, 87.2)), lerp(-300, -330, ramp(t, 81.4, 87.2)), 1.05 + 0.08 * Math.sin((t - 81.44) * 0.5), 0.02 * Math.sin((t - 81.44) * 0.9));
  }],
  [87.16, 90.02, (t, api) => {   // S17 黑夜里闭着眼摸黑奔跑，手划过的地方亮起彩带
    NIGHT = 0.5; const s = (t - TRAIL.t0) * TRAIL.speed;
    const P = walk({ expr: 5, tailPh: t * 6, tailAmp: 0.5 }, TRAIL.x0, s, { dir: 1, stride: 520, stance: 0.42, lift: 70, swing: 0.2, bob: 16, lean: 0.18, sc: 1.1 });
    P.y = GY; P.hands = { n: toLocal(P, trailHand(t)), f: [-120, -250] }; P.elbowN = -1;
    fox(api, 'kid', P); camTo(P.x + 120, -330, 0.8);
  }],
  [90.02, 92.88, (t, api) => {   // S18 在星星之间转圈跳舞
    NIGHT = 0.5; const ph = (t - 90.02) * 2.2 * Math.PI, hop = Math.abs(Math.sin(((t - 90.02) / BT) * Math.PI)) * 34;
    fox(api, 'kid', { x: SPIN.x, y: GY, face: 1, sx: clamp(Math.cos(ph) * 5, -1, 1) || 1, scale: 1.1, expr: 1, lift: hop, hands: { n: [150 + 30 * Math.sin(ph * 2), -330], f: [-150, -330 + 30 * Math.cos(ph * 2)] }, elbowN: -1, elbowF: 1, tailPh: t * 8, tailAmp: 0.6, squash: 0.4 * (1 - hop / 34) });
    camTo(SPIN.x, -340 - 40 * ramp(t, 90, 92.9), 0.85 + 0.15 * ramp(t, 90, 92.9), 0.04 * Math.sin(t * 1.2));
  }],
  [92.88, 95.74, (t, api) => {   // S19 蹲下，从书包里拿出一只纸船，放到彩色的波浪上
    NIGHT = 0.5; const x = SEA.x0 - 120, c = ramp(t, 93.0, 93.6), take = ramp(t, 93.4, 94.1), place = ramp(t, 94.3, 95.1);
    const P = { x, y: GY, face: 1, scale: 1.1, crouch: 2.4 * c, lean: 0.85 * c, headTilt: 0.22 * c, expr: place > 0.6 ? 1 : 0, tailPh: t * 2, tailAmp: 0.25 };
    const hw = [lerp(x + 40, x + 140, take), lerp(-160, -60, take)], pw = [x + 175, waveY(x + 175) - 18];
    P.hands = { n: toLocal(P, place > 0 ? [lerp(hw[0], pw[0], place), lerp(hw[1], pw[1] - 30, place)] : hw), f: toLocal(P, [hw[0] - 30, hw[1] + 10]) };
    fox(api, 'kid', P);
    if (take > 0.05) { const bx = place > 0 ? lerp(hw[0], pw[0], place) : hw[0], by = place > 0 ? lerp(hw[1] + 30, pw[1], place) : hw[1] + 30; drawBoat(api, bx, by, 0.85, 0.05 * Math.sin(t * 5)); }
    camTo(x + 180, -120, 1.3);
  }],
  [95.74, 98.60, (t, api) => {   // S20 纸船穿过一片嘲笑声，靠了岸
    NIGHT = 0.5; const u = clamp((t - 95.74) / 2.7), bx = lerp(SEA.x0 + 180, SEA.x1 - 140, eio(u));
    fox(api, 'kid', { x: SEA.x0 - 120, y: GY, face: 1, scale: 1.1, crouch: 1.0, lean: 0.25, headTilt: -0.12, expr: 2, tailPh: t * 2, tailAmp: 0.3 });
    drawBoat(api, bx, waveY(bx) - 18, 1.0, 0.1 * Math.sin(t * 4));
    camTo(lerp(SEA.x0 + 900, SEA.x1 - 700, eio(u)), -330, 0.48);
  }],
  [98.60, 104.32, (t, api) => {   // S21 课桌两边对坐；大人提起桌上的包，推开椅子站起来——失陪
    NIGHT = 0.15; const up = ramp(t, SB(101.46), SB(101.46) + 0.9);
    chairA.forEach((s) => (s.move = [-150 * up, 0]));
    fox(api, 'kid', { x: A3.cx + 378, face: -1, scale: 1.05, crouch: 0.72, feet: { n: [70, 0], f: [50, 0] }, expr: up > 0.5 ? 3 : 0, headTilt: 0.04 * up, hands: { n: [130, -224], f: [100, -224] }, elbowN: 1, elbowF: 1, tailPh: t * 2, tailAmp: 0.18, ...breathe(t, 0.5) });
    const ax = A3.cx - 381 - 70 * up, P = { x: ax, face: 1, crouch: 3.0 * (1 - up), feet: { n: [lerp(130, 30, up), 0], f: [lerp(100, -30, up), 0] }, headTilt: 0.12 * up, expr: up > 0.3 ? 2 : 0, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.5) };
    const caseHand = [A3.cx - 200 - 70 * up * 0.5, lerp(-340, -500, up)];
    P.hands = { n: toLocal(P, up > 0 ? caseHand : [A3.cx - 200, -340]), f: toLocal(P, [A3.cx - 250, -232]) };
    P.briefcase = true;
    fox(api, 'adult', P);
    camTo(A3.cx, -420, 0.75 + 0.05 * ramp(t, 98.6, 104.3));
  }],
  [104.32, 110.04, (t, api) => {   // S22 正反打：少年抬头看他 / 他别开脸
    NIGHT = 0.15; const rev = t >= SB(107.18);
    const K = { x: A3.cx + 378, face: -1, scale: 1.05, crouch: 0.72, feet: { n: [70, 0], f: [50, 0] }, expr: 3, headTilt: -0.12 + 0.02 * Math.sin(t * 1.5), hands: { n: [130, -224], f: [100, -224] }, elbowN: 1, elbowF: 1, tailPh: t * 2, tailAmp: 0.12, ...breathe(t, 0.8), look: [-0.2, -0.3] };
    if (blink(t, [105.7, 108.6])) { K.expr = 0; K.eyes = 2; }
    const A = { x: A3.cx - 451, face: rev ? -1 : 1, expr: 2, headTilt: 0.16 + 0.03 * Math.sin(t * 1.1), tailPh: t, tailAmp: 0.08, ...breathe(t, 0.8) };
    fox(api, 'kid', K); fox(api, 'adult', A);
    if (!rev) camTo(A3.cx + 330, -470, 1.65 + 0.12 * ramp(t, 104.3, 107.2)); else camTo(A3.cx - 470, -720, 1.55 + 0.12 * ramp(t, 107.2, 110));
  }],
  [110.04, 115.76, (t, api) => {   // S23 黑板一分为二：少年留在彩格里，他朝白格子越走越远
    NIGHT = 0.15; const s = (t - 110.04) * 330, sc = lerp(1, 0.55, ramp(t, 110.5, 115.7));
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6) });
    const P = walk({ expr: 2, tailPh: t * 1.5, tailAmp: 0.1 }, SPLIT.x + 500, s, { dir: 1, stride: 300 * sc, lift: 22 * sc, sc });
    P.y = -60 * (1 - sc); fox(api, 'adult', P);
    lerpCam([SPLIT.x - 200, -420, 0.38], [SPLIT.x + 100, -440, 0.3], eio((t - 110.04) / 5.72));
  }],
  [115.76, 118.62, (t, api) => {   // S24 少年的脸：没哭，只是看着；颜色被一层层灰盖上
    NIGHT = 0.15;
    const K = { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, headTilt: -0.05 + 0.02 * Math.sin(t * 1.4), tailPh: t, tailAmp: 0.08, ...breathe(t, 1), look: [0.3, 0] };
    if (blink(t, [117.2])) { K.expr = 0; K.eyes = 2; }
    fox(api, 'kid', K);
    camTo(KX2 + 10, -400, 1.9 + 0.15 * ramp(t, 115.8, 118.6));
    for (let k = 0; k < 3; k++) eraserBand(api, KX2 - 230, KX2 + 230, -560 + k * 170, -360 + k * 170, 0.55 * ramp(t, 116.0 + k * 0.7, 116.9 + k * 0.7), 20 + k);
  }],
  [118.62, 122.91, (t, api) => {   // S25 他扔下包，回头往少年跑，被一条白线拦住，空手伸过去
    NIGHT = 0.15; const x0 = SPLIT.x + 1400, run = clamp((t - 119.0) / 1.05);
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: t > 120.3 ? 4 : 3, tailPh: t, tailAmp: 0.1, ...breathe(t, 0.6) });
    drawCaseProp(api, x0 - 60, 0);
    let P;
    if (t < 119.0) P = { x: x0, face: lerp(1, -1, ramp(t, 118.65, 118.95)) >= 0 ? 1 : -1, expr: 5, briefcase: false, tailPh: t, tailAmp: 0.15 };
    else if (run < 1) P = walk({ expr: 5, tailPh: t * 5, tailAmp: 0.3, briefcase: false }, x0, run * 1100, { dir: -1, stride: 420, stance: 0.45, lift: 40, lean: 0.15 });
    else { const st = t - 120.05; P = { x: x0 - 1100 + 26 * Math.sin(st * 20) * Math.exp(-st * 4), face: -1, expr: 5, briefcase: false, lean: -0.06, tailPh: t, tailAmp: 0.15, hands: { n: [280 + 30 * ramp(st, 0.3, 1.5), -560] }, elbowN: -1 }; }
    fox(api, 'adult', P);
    lerpCam([SPLIT.x - 450, -440, 0.42], [SPLIT.x - 150, -480, 0.5], eio((t - 118.62) / 4.3));
  }],
  [122.91, 128.63, (t, api) => {   // S26 跪下来，把笑脸朝上的硬币轻轻放在线上
    NIGHT = 0.15; const x = SPLIT.x + 420, put = ramp(t, 124.4, 126.2);
    const P = { x, face: -1, crouch: 2.4 * put, lean: 0.9 * put, headTilt: 0.25 + 0.1 * put, expr: t > 126.6 ? 3 : 2, briefcase: false, tailPh: t, tailAmp: 0.08, ...breathe(t, 0.5) };
    const hand = [lerp(x - 200, SPLIT.x + 232, put), lerp(-470, 2, put)];
    P.hands = { n: toLocal(P, hand) }; fox(api, 'adult', P);
    drawCoin(api, hand[0], t > 126.2 ? 10 : hand[1] + 8, 28, Math.PI, true);
    drawCaseProp(api, SPLIT.x + 1340, 0);
    lerpCam([hand[0], hand[1] - 30, 2.1], [x - 160, -360, 0.9], eio((t - 122.91) / 5.7));
  }],
  [128.63, 137.21, (t, api) => {   // S27 板擦从右往左慢慢擦过：白格子和他被擦淡，彩色的少年没被擦掉
    NIGHT = 0.15; const x = SPLIT.x + 420, wx = lerp(SPLIT.x + 4600, SPLIT.x + 330, clamp((t - 129.2) / 7.6));
    fox(api, 'kid', { x: KX2, y: GY, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.08, ...breathe(t, 0.6) });
    fox(api, 'adult', { x, face: -1, crouch: 2.4, lean: 0.9, headTilt: 0.35, expr: 3, briefcase: false, hands: { n: [190, -40] }, ink: 1 - ramp(wx, x + 700, x - 200), tailPh: t, tailAmp: 0.05 });
    drawCoin(api, SPLIT.x + 232, 10, 28, Math.PI, true);
    eraserBand(api, wx - 200, wx + 600, -1300, 300, 0.9 * bump(t, 129.0, 137.0), 31); eraserBand(api, wx + 300, SPLIT.x + 4600, -1100, 200, 0.25 * ramp(t, 129.5, 131), 32);
    lerpCam([SPLIT.x + 600, -420, 0.4], [SPLIT.x - 500, -420, 0.36], eio((t - 128.63) / 8.6));
  }],
  [137.21, 147.03, (t, api) => {   // S28 只剩那枚硬币和一截粉笔头；少年还在原地，看着它；拉远，暗下去
    NIGHT = 0.15 + 0.35 * ramp(t, 140, 146.5);
    eraserBand(api, SPLIT.x + 330, SPLIT.x + 4600, -1100, 200, 0.25, 32);
    drawCoin(api, SPLIT.x + 232, 10, 28, Math.PI, true);
    const roll = ramp(t, 139.4, 141.4); drawStub(api, SPLIT.x + 300 + roll * 46, 16, roll * 1.7 + 0.2);
    const K = { x: KX2, y: GY, face: 1, scale: 1.05, expr: 0, headTilt: -0.05 + 0.08 * ramp(t, 141.6, 143), tailPh: t, tailAmp: 0.1, ...breathe(t, 0.8) };
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
window.renderAt = (t) => renderFrame(t, (t, api) => {
  NIGHT = 0;
  for (const s of WORLD) { s.move = null; s.front = false; s.vis = !(s.group === 'bikeW' || s.group === 'bikeC'); }
  const shot = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  PROBE = true; shot[2](t, { ...api, board: dummy }); PROBE = false;     // 先跑一遍拿相机和道具状态
  drawSlate(api.board);
  if (NIGHT > 0) { api.board.save(); api.board.setTransform(1, 0, 0, 1, 0, 0); api.board.fillStyle = `rgba(4,10,22,${0.42 * NIGHT})`; api.board.fillRect(0, 0, W, H); api.board.restore(); }
  layer.s = cam.s;
  const S = 1 / cam.s, view = [cam.x - (W / 2) * S - 200, cam.y - (H / 2) * S - 200, cam.x + (W / 2) * S + 200, cam.y + (H / 2) * S + 200];
  drawWorldPass(api.board, t, view, false);
  shot[2](t, api);
  if (WORLD.some((s) => s.front && s.vis !== false)) drawWorldPass(api.board, t, view, true);
});
window.SHOTS = SHOTS.map((s) => [s[0], s[1]]);
window.READY = true;
