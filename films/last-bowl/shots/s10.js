// S10 —— 台面高度侧拍：师傅双手托碗推过柜台，老主顾的手右入托住；28.5 起画内换 harmony 静帧，只有热气循环，静帧向左横摇 16 px（TREATMENT §4 S10、§5、§9）
// 粗剪第 2 轮（CONTINUITY.md）：手型重摆成「托碗」cradle —— 拇指搭在碗沿上、四指托在碗腹下面，不再拿 grip 转 90° 顶替。
// 师傅在左：近手（右手）捧着碗腹左下，手背 3/4 斜对镜头（第 3 轮：四指排成扇、各节都弯，拇指翻上碗沿）；远手（左手）在碗后，只露出搭在远侧碗沿上的拇指。
// 老主顾在右：左手，同一手型镜像，掌更瘦、指节冻红、藏青棉袄袖。
// 碗和 S9 是同一只：面条在碗心绕一圈，葱花按 S9 两撮的落点撒在碗心偏右。s11.js 共用这里的布局和画法（导出名不变）。
import { cel, path, airbrush, mix, rgba, rng, hash, hex, canvas, W, H } from '../lib/cel.js';
import { C } from '../pal.js';
import { hand, digit, part, backOfHand, FW, FWK } from '../hands.js';
import { steam } from '../fx.js';

// 碗和手在「设计坐标」里画（碗底落在 y 699），再整体放大 K 倍贴到台面上（碗底 BASE）：两手加碗约 375 px 高（§4.2 关键画面 ≥ 360 px）
// ery 14 → 24：机位比台面略高一点，碗口里的面条和葱花看得见（S9 → S10 同一只碗）
export const L = { bx: 960, ry: 470, rx: 250, ery: 24, h: 205, foot: 24, top: 756, front: 862, s: 250, sg: 220, K: 1.25, BASE: 806, B0: 699 };
export const toScreen = (dx = 0) => new DOMMatrix().translate(dx, 0).translate(960, L.BASE).scale(L.K, L.K).translate(-960, -L.B0);
export const q12 = t => Math.floor(t * 12 + 1e-6) / 12;
export const easeOut = u => u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) * (1 - u);
const D = Math.PI / 180, TAU = Math.PI * 2;

// —— 背景：暖灯下的后墙 + 柜台（台面一窄条 + 台边）。画宽一些，横摇时不露边 ——
export function backdrop(g) {
  g.fillStyle = '#6A5060'; g.fillRect(-60, -60, W + 120, H + 120);
  airbrush(g, 430, 260, 1250, 760, '#CBB08A', .95, .85);          // 吊灯在左上（画外）
  airbrush(g, 1820, 120, 760, 620, '#5A4458', .75, .9);           // 远角压暗
  airbrush(g, 760, 560, 560, 320, '#E6C79A', .35, 1);             // 碗后墙上一团暖光
  g.fillStyle = '#5E4656'; g.fillRect(-60, L.top - 70, W + 120, 70);   // 墙根一道暗带（墙裙）
  g.fillStyle = '#4A3550'; g.fillRect(-60, L.top - 10, W + 120, 10);
  // 台面：一窄条，碗周围吃灯光
  g.fillStyle = '#7A4A2A'; g.fillRect(-60, L.top, W + 120, L.front - L.top);
  g.save(); g.beginPath(); g.rect(-60, L.top, W + 120, L.front - L.top); g.clip();
  airbrush(g, 820, (L.top + L.front) / 2, 800, 80, '#A86E3C', 1, .55);
  g.strokeStyle = '#3A2418'; g.lineWidth = 2;
  const R = rng(1010);
  for (let i = 0; i < 6; i++) {                                   // 木纹：几道细长的线，透视里几乎是水平的
    const y = L.top + 10 + i * 15 + R() * 6; g.beginPath(); g.moveTo(-60, y);
    for (let x = 0; x <= W + 60; x += 160) g.lineTo(x, y + Math.sin(x * .004 + i) * 2.5);
    g.stroke();
  }
  g.restore();
  g.fillStyle = '#C08A52'; g.fillRect(-60, L.front - 5, W + 120, 5);  // 台沿圆角吃光：一条硬高光
  g.fillStyle = '#3A2418'; g.fillRect(-60, L.front, W + 120, 3);
  g.fillStyle = '#4A3550'; g.fillRect(-60, L.front + 3, W + 120, H - L.front + 60);   // 台边竖面：暗部紫
  g.fillStyle = '#3E2C46'; for (let i = 0; i < 5; i++) g.fillRect(-60, L.front + 70 + i * 62, W + 120, 3);
}

// —— 碗：侧拍，碗口是一道扁椭圆 ——
const rimPts = (bx, ry, from, to, n = 24) => { const p = []; for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; p.push([bx + L.rx * Math.cos(a), ry + L.ery * Math.sin(a)]); } return p; };
// 碗身外形（前半圈碗沿 → 碗壁 → 圈足上沿）
export function bowlBody(bx, ry) {
  const { rx, h } = L, side = sg => [[bx + sg * (rx - 8), ry + h * .28], [bx + sg * rx * .80, ry + h * .66], [bx + sg * rx * .55, ry + h * .92], [bx + sg * 104, ry + h, 1]];
  return path([...rimPts(bx, ry, 0, Math.PI).map((q, i, a) => i === 0 || i === a.length - 1 ? [...q, 1] : q), ...side(-1), ...side(1).reverse()]);
}
// 汤面上的东西和 S9 同一份：S9 的汤面中心 / 半径、两撮葱花的落点，按归一化坐标搬进 S10 的扁椭圆
const S9 = { SC: [860, 590], SR: [478, 214], LAND: [[925, 585], [995, 620]] };
const NOOD = { f: '#F2D99F', l: '#8C6440' }, SCAL = { f: '#86B151', w: '#EEEABE', l: '#2E4A26' };
function soupTop(g, bx, ry) {
  const { rx, ery } = L, sx = rx * .93, sy = ery * .78, cy = ry + ery * .12;
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {                                    // 面条：碗心一圈 7 道弧（S9 的面条也是绕着碗心一圈）
    const a = i / 7 * TAU + hash(i + 9) * .5, cx = bx - 10 + Math.cos(a) * sx * .42, y = cy + Math.sin(a) * sy * .45, w = 46 + 30 * hash(i + 4);
    const arc = () => { g.beginPath(); g.moveTo(cx - w / 2, y + 2); g.quadraticCurveTo(cx, y - 5, cx + w / 2, y + 1.5); g.stroke(); };
    g.strokeStyle = NOOD.l; g.lineWidth = 8.5; arc(); g.strokeStyle = NOOD.f; g.lineWidth = 5.5; arc();
  }
  for (let p = 0; p < 2; p++) for (let j = 0; j < 24; j++) {      // 葱花：S9 两撮落定的位置（同一套随机种子）
    const R = rng(4100 + p * 97 + j), a = R() * TAU, u = Math.sqrt(R()), sz = (13 + R() * 5) * .5, id = j + p * 24;
    const nx = (S9.LAND[p][0] + Math.cos(a) * 120 * u - S9.SC[0]) / S9.SR[0], ny = (S9.LAND[p][1] + Math.sin(a) * 60 * u - S9.SC[1]) / S9.SR[1];
    const x = bx + nx * sx, y = cy + ny * sy, ty = hash(id * 3.3);
    g.fillStyle = ty < .85 && ty >= .62 ? SCAL.w : SCAL.f; g.strokeStyle = SCAL.l; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(x, y, ty >= .85 ? sz * .8 : sz * .5, sz * .26, 0, 0, TAU); g.fill(); g.stroke();
    if (ty < .62) { g.fillStyle = SCAL.w; g.beginPath(); g.ellipse(x, y, sz * .2, sz * .1, 0, 0, TAU); g.fill(); }
  }
}
export function drawBowl(g, bx, ry, o = {}) {
  const { rx, ery, h, foot } = L, bw = C('bowl'), rim = C('rim'), base = ry + h + foot;
  // 投影：落在台面上，往右（灯在左上），硬边
  g.fillStyle = '#5A3A3E'; g.beginPath(); g.ellipse(bx + 70, base - 2, 175, 13, 0, 0, Math.PI * 2); g.fill();
  // 圈足
  cel(g, [[bx - 104, ry + h - 4, 1], [bx + 104, ry + h - 4, 1], [bx + 98, base, 1], [bx - 98, base, 1]], { f: bw.s, l: bw.l, lw: 2, sh: [[[bx + 30, ry + h - 6], [bx + 110, ry + h - 6], [bx + 110, base + 2], [bx + 24, base + 2]]], s: mix(bw.s, bw.l, .35) });
  // 碗身：平涂 + 右下一弯硬边阴影 + 左边一条竖向硬高光
  const body = bowlBody(bx, ry);
  cel(g, body, { f: bw.f, s: bw.s, so: [-46, -26], h: '#FFF8EA', hi: [[[bx - rx + 40, ry + 26], [bx - rx + 70, ry + 26], [bx - rx * .62, ry + h * .78], [bx - rx * .72, ry + h * .74]]], l: bw.l, lw: 2.2 });
  // 红沿：碗口外沿一圈红带（侧拍时是一条略弯的横带），右段落进阴影
  const band = path([...rimPts(bx, ry, 0, Math.PI), ...rimPts(bx, ry + 17, Math.PI, 0)]);
  cel(g, band, { f: rim.f, s: rim.s, sh: [[[bx + rx * .42, ry - 20], [bx + rx + 10, ry - 20], [bx + rx + 10, ry + 60], [bx + rx * .36, ry + 60]]], h: rim.h, hi: [[[bx - rx * .78, ry + 10], [bx - rx * .45, ry + 20], [bx - rx * .45, ry + 25], [bx - rx * .8, ry + 15]]], l: rim.l, lw: 1.8 });
  if (o.glint != null && o.glint < 1) {                            // 接 S9 出点：碗沿上那道高光接着往右滑完（头 6 帧）
    const x = bx + rx * (.15 + .8 * o.glint);
    g.save(); g.clip(band); g.fillStyle = rim.h; g.beginPath(); g.moveTo(x - 10, ry - 30); g.lineTo(x - 2, ry - 30); g.lineTo(x + 12, ry + 60); g.lineTo(x + 4, ry + 60); g.fill(); g.restore();
  }
  // 碗口：里壁一窄条 + 汤面（空碗时只剩白瓷里壁和一道汤渍）
  const mouth = new Path2D(); mouth.ellipse(bx, ry, rx, ery, 0, 0, Math.PI * 2);
  g.fillStyle = o.empty ? mix(bw.f, bw.s, .35) : '#6C3E2C'; g.fill(mouth);
  g.save(); g.clip(mouth);
  if (!o.empty) { g.fillStyle = '#C8944F'; g.beginPath(); g.ellipse(bx + 8, ry + 5, rx * .99, ery, 0, 0, TAU); g.fill(); }   // 汤：远侧一弯碗壁投下的深色
  g.fillStyle = o.empty ? bw.f : '#E9D7B4'; g.beginPath(); g.ellipse(bx, ry - ery * .62, rx * .98, ery * .62, 0, Math.PI, Math.PI * 2); g.fill();   // 远侧里壁
  if (o.empty) { g.fillStyle = '#B07A4A'; g.fillRect(bx - rx * .5, ry + 2, rx, 3); }                  // 碗底一道汤渍
  else { soupTop(g, bx, ry); g.fillStyle = '#FFE6B8'; g.fillRect(bx - rx * .72, ry - 3, 64, 3); }   // 汤面一道硬高光（吊灯倒影，左边）
  g.restore();
  g.strokeStyle = rim.f; g.lineWidth = 6; g.stroke(mouth);                                               // 碗口一圈红
  g.strokeStyle = rim.l; g.lineWidth = 1.8; g.beginPath(); g.ellipse(bx, ry, rx + 3, ery + 3, 0, Math.PI, Math.PI * 2); g.stroke();
}

// —— 手：托碗手型 cradle（粗剪第 3 轮重摆）——
// 设计空间：u 朝右、v 朝下，掌宽 = 1，原点 = 碗沿左端（师傅的右手，前臂从左边来；老主顾是它的镜像）。
// 碗在这个空间里：碗沿 v 0，碗腹左轮廓 (.03,.23) → (.20,.54) → (.45,.75)，碗底 v .82，台面（碗脚落点）v .92。
// 第 2 版的毛病：从拇指一侧正侧看，四指叠成一根香肠，拇指是一根横插的木栓。第 3 轮改成手背 3/4 斜对镜头、手掌捧着碗腹左下：
//   拇指从大鱼际往右上翻上碗沿，指间关节扣下来，指肚压在红沿上、指尖探进碗口（和四指隔开一个虎口）；
//   四指从食指到小指自上而下排成一把扇：骨节连成一道弧（中指骨节最突出），根节角度 8° → 43° 一根比一根斜、间距不等；
//   每根都往掌心（碗）一侧弯，各节弯得不一样：食指、中指贴着碗腹前下方包过去，无名指、小指收到碗腹底下的空当里（碗脚旁边、贴着台面）。
//   腕比前臂往下折一点（手顺着碗腹往下捧），前臂从画外斜着进来，在肘那里折一个小角（不是一根直管）。
// op：0 托住 → 1 张开（入画时的中间张：四指伸直、散开，拇指抬起）
const lerp = (a, b, k) => a + (b - a) * k;
// [手指, 指根(MCP), 托住时三节角度°（0 朝右、90 朝下）, 张开时, 三节可见长（掌宽）]
const CFING = [
  ['l', [-.02, .81], [50, 32, 16], [42, 37, 31], [.15, .09, .06]],   // 小指收在最下、最短，指尖不过台沿
  ['r', [.08, .765], [34, 20, 2], [26, 22, 17], [.23, .13, .08]],
  ['m', [.15, .625], [14, 2, -14], [9, 6, 2], [.30, .18, .11]],      // 中指最长、伸得最远
  ['i', [.13, .49], [-2, -12, -28], [-6, -7, -10], [.26, .15, .09]],  // 食指贴着碗腹往上包，末节绕向碗里（缩短）
];
// 手背 + 掌根：腕（尺侧 → 桡侧）→ 大鱼际顶 → 虎口 → 食指骨节 → 一道骨节弧 → 小指骨节 → 小鱼际 → 回腕
const CPALM = [[-.76, .53, 1], [-.65, .02, 1], [-.47, .03], [-.34, .05], [-.23, .11], [-.13, .21], [-.02, .32], [.08, .41], [.15, .48],
  [.19, .57], [.18, .66], [.12, .75], [.05, .82], [-.04, .89], [-.13, .93], [-.27, .91], [-.45, .81], [-.64, .63]];
const CBACK_SH = [[-.13, .93], [-.27, .91], [-.45, .81], [-.64, .63], [-.76, .53], [-.70, .52], [-.52, .63], [-.34, .76], [-.18, .84], [-.06, .84]];   // 手背往下转开：沿下沿一条硬边影
function cradleData(op = 0, thin = 1) {
  const fing = CFING.map(([f, b, a0, a1, ls], i) => {
    const angs = a0.map((a, j) => lerp(a, a1[j], op)), J = [b];
    ls.forEach((l, j) => J.push([J[j][0] + Math.cos(angs[j] * D) * l, J[j][1] + Math.sin(angs[j] * D) * l]));
    return { f, b, angs, ls, J, w: FW * FWK[f] * thin, id: 40 + i };
  });
  // 拇指：根在大鱼际顶上，近节往右上立起，指间关节扣下 ~60°，末节横压在碗沿上（张开时抬起、伸直）
  const th = { b: [-.27, .10], angs: [lerp(-57, -66, op), lerp(4, -40, op)], ls: [.27, .23], w: .27 * thin };
  return { fing, th, wrist: [-.705, .275], armA: 192 };   // 腕中点 = 两个腕角的中点（掌根和前臂接得顺，不出台阶）
}
const toL = ([u, v, k]) => k ? [v, -u, 1] : [v, -u];   // 设计空间 → hands.js 本地（rot 90° 时前臂从左来）
export function cradle(o = {}) {
  const d = cradleData(o.op, o.thin), A = a => a - 90;
  const palm = part('skin', ['W', ...CPALM.map(toL)], { cal: [[[-.31, .07], [-.20, .12], [-.17, .18], [-.27, .15]].map(toL)], sh: [CBACK_SH.map(toL)],   // 虎口老茧
    ln: [[[-.42, .44], [-.24, .53], [-.08, .58]].map(toL)] });   // 手背一道浅褶
  backOfHand(palm, ['l', 'r', 'm', 'i'].map(f => toL(d.fing.find(q => q.f === f).b)), toL(d.wrist), 12);
  const F = d.fing.map(q => digit(toL(q.b), q.angs.map(A), q.ls, { w: q.w, back: true, id: q.id, cal: q.f === 'i' ? 1 : 0 }));
  const thumb = digit(toL(d.th.b), d.th.angs.map(A), d.th.ls, { w: d.th.w, nail: true, back: true, id: 47 });
  return { arm: { w: toL(d.wrist), a: A(d.armA), ww: .62 }, parts: [palm, ...F.flat(), ...thumb] };   // 小指先画、食指压在最上；拇指在最前
}
// 设计空间 → 碗的设计坐标：E = 锚点（碗沿端点），mir = 老主顾（镜像）
const at = (E, s, mir, [u, v]) => [E[0] + (mir ? -u : u) * s, E[1] + v * s];
// 前臂：袖子从腕往画外走 0.8 掌宽（到画框边上）后在肘处往上折 12°（本地角），整条胳膊带一点弧
const ELBOW = { at: .8, a: 192 - 90 + 12, len: 3 };
function cradleHand(x, E, s, o = {}) {
  hand(x, null, { x: E[0], y: E[1], s, rot: (o.mir ? -90 : 90) * D + (o.rot || 0), side: o.mir ? 'L' : 'R', pose: cradle, op: o.op || 0, thin: o.thin || 1, light: 'warm', arm: 3.8, elbow: ELBOW });
}
// 旧接口（s11.js 用）：锚点 = 原来的掌下点，换算到碗沿端点
export function masterHand(x, ax, ay, rot = 90 * D) { cradleHand(x, [ax - 72, ay - 131], L.s, { rot: rot - 90 * D }); }

const [HC, hc] = canvas(W, H), [GC, gc] = canvas(W, H), [CC, cc] = canvas(W, H);
const clear = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); };
// 老主顾换色：师傅暖灯色 → 老主顾皮肤 / 藏青棉袄（§4.2、§4.3），按最近色逐像素换（cel 是平涂，边缘只差半透明）
const SWAP = [['#D9A07A', '#CDAB94'], ['#9C6250', '#8B6364'], ['#4A2A1E', '#432A35'], ['#E3B28A', '#DABA9D'], ['#E6BA8F', '#CDAB94'], ['#AB7662', '#8B6364'],
  [mix('#E6BA8F', '#E3B28A', .5), '#DABA9D'], [mix('#D9A07A', '#9C6250', .45), mix('#CDAB94', '#8B6364', .45)],
  ['#E8DCC0', '#343D5D'], ['#8C749B', '#1B1C3C'], [mix('#E8DCC0', '#FFE6B8', .25), '#4A5374'], ['#63554D', '#141626'],
  ['#C8B07A', '#3A4466'], ['#7A5C56', '#1B1C3C'], [mix('#C8B07A', '#FFE6B8', .25), '#676774']].map(([a, b]) => [hex(a), hex(b)]);
function recolor(x, x0, y0, w, h) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); w = Math.min(W - x0, Math.ceil(w)); h = Math.min(H - y0, Math.ceil(h));
  if (w <= 0 || h <= 0) return;
  const im = x.getImageData(x0, y0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let b = 0, bd = 1e9;
    for (let k = 0; k < SWAP.length; k++) { const s = SWAP[k][0], r = d[i] - s[0], gg = d[i + 1] - s[1], bb = d[i + 2] - s[2], dd = r * r + gg * gg + bb * bb; if (dd < bd) { bd = dd; b = k; } }
    const tc = SWAP[b][1]; d[i] = tc[0]; d[i + 1] = tc[1]; d[i + 2] = tc[2];
  }
  x.putImageData(im, x0, y0);
}
// 老主顾的手（左手，前臂从右来）：旧接口锚点 (ax, ay) 换算到碗沿右端；cuff = 'snow' | 'wet' | 'streak'；op 张开程度（入画中间张）
export function guestHand(x, ax, ay, cuff = 'snow', M = new DOMMatrix(), op = 0) {
  const E = [ax + 72, ay - 150], s = L.sg, d = cradleData(op, .9), P = q => at(E, s, true, q);
  clear(gc); gc.setTransform(M);
  cradleHand(gc, E, s, { mir: true, op, thin: .9 });
  const p = M.transformPoint(new DOMPoint(E[0], E[1]));
  recolor(gc, p.x - 360, 0, W, H);
  gc.globalCompositeOperation = 'source-atop';                    // 冻红：只落在手上
  const fr = C('frostbite'), ix = d.fing[3], mf = d.fing[2];
  const spots = [[ix.J[0], 13, .9], [ix.J[1], 0, .8], [ix.J[2], -21, .65], [mf.J[1], -6, .6], [[d.th.b[0] + .2, d.th.b[1] - .16], 0, .55]];
  for (const [q, a, k] of spots) {                                // 指节背侧（往外一点）一块硬边冻红 + 一小块暗
    const n = [-Math.sin(a * D) * .035, Math.cos(a * D) * .035], c = P([q[0] + n[0] + .02, q[1] + n[1]]);
    gc.globalAlpha = .62; gc.fillStyle = fr.f; gc.beginPath();      // 一块冻红的平涂（不规则、贴着骨节横着长），不画成圆点
    for (let j = 0; j < 7; j++) { const an = j / 7 * TAU, f = .78 + .3 * hash(j + q[0] * 50), r = [24 * k * f, 12 * k * f]; gc[j ? 'lineTo' : 'moveTo'](c[0] + Math.cos(an) * r[0], c[1] + Math.sin(an) * r[1]); }
    gc.closePath(); gc.fill(); gc.globalAlpha = 1;
  }
  gc.globalCompositeOperation = 'source-over';
  const R = rng(5150), dv = [Math.cos(12 * D), -Math.sin(12 * D)], nv = [-dv[1], dv[0]];   // 袖口：前臂往右上去，袖口在腕外 0.4–0.6 掌宽
  for (let i = 0; i < 6; i++) {                                   // 雪粒 → 湿点 → 水痕
    const t = .44 + (R() - .5) * .08, xx = -.40 + i * .16 + (R() - .5) * .05, w0 = [-d.wrist[0], d.wrist[1]];
    const px = E[0] + (w0[0] + dv[0] * t + nv[0] * xx) * s, py = E[1] + (w0[1] + dv[1] * t + nv[1] * xx) * s, r = 3 + R() * 2;
    if (cuff === 'snow') { gc.fillStyle = '#E8E5DA'; gc.beginPath(); gc.arc(px, py, r, 0, TAU); gc.fill(); gc.strokeStyle = '#8C93B8'; gc.lineWidth = 1; gc.stroke(); }
    else if (cuff === 'wet') { gc.fillStyle = '#1B1C3C'; gc.beginPath(); gc.ellipse(px, py, r * 1.4, r, .3, 0, TAU); gc.fill(); }
    else if (i % 2 === 0) { gc.strokeStyle = '#FFE6B8'; gc.lineWidth = 1.6; gc.beginPath(); gc.moveTo(px, py - 6); gc.lineTo(px + 3, py + 12); gc.stroke(); }
  }
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(GC, 0, 0); x.restore();
}

// —— 合成一帧：背景 → 碗 → 远手拇指（碗后，只留远侧碗沿以上）→ 近手（整只在碗前）→ 老主顾的手 → harmony 喷枪层 → 热气 ——
// o = { dx 横摇, bx 碗心 x, by 碗抬起（px，往上为负）, empty, glint, harm, master: [ax, ay, rot?] | null, far: [ax, ay, drot?] | null,
//       guest: [ax, ay, cuff, op?] | null, steam: 秒 | null, under / over: (x, bx, ry) => void }（锚点沿用旧的掌下点，换算在 masterHand / guestHand）
export function scene(g, e, o) {
  const dx = o.dx || 0, bx = o.bx ?? L.bx, ry = L.ry + (o.by || 0), M = toScreen(dx);
  g.save(); g.translate(dx, 0); backdrop(g); g.restore();
  clear(cc); cc.setTransform(M);
  if (o.under) o.under(cc, bx, ry);
  drawBowl(cc, bx, ry, o);
  if (o.over) o.over(cc, bx, ry);
  if (o.far) {                                                       // 远手（左手）在碗后：碗口、碗身和近手挡住它，只露出搭在远侧碗沿上的拇指
    clear(hc); hc.setTransform(M);
    cradleHand(hc, [o.far[0] - 40, o.far[1] - 122], L.s, { rot: o.far[2] || 0 });   // 第 3 轮：拇指末节的指肚落在远侧碗沿上（不悬空）
    hc.globalCompositeOperation = 'destination-out';
    hc.beginPath(); hc.ellipse(bx, ry, L.rx, L.ery, 0, 0, TAU); hc.fill(); hc.fillRect(-600, ry, W + 1200, H); hc.fillRect(-600, -600, bx - L.rx + 600 + 12, H + 1200);
    hc.globalCompositeOperation = 'source-over';
    cc.save(); cc.setTransform(1, 0, 0, 1, 0, 0); cc.drawImage(HC, 0, 0); cc.restore();
  }
  if (o.master) masterHand(cc, o.master[0], o.master[1], o.master[2] ?? 90 * D);
  if (o.guest) guestHand(cc, o.guest[0], o.guest[1], o.guest[2], M, o.guest[3] || 0);
  if (o.harm) {                                                       // harmony：同一份线稿，平涂上盖喷枪渐变（只落在 cel 上）
    cc.save(); cc.setTransform(M); cc.globalCompositeOperation = 'source-atop';
    const gr = cc.createLinearGradient(bx - 520, ry - 260, bx + 420, ry + 320);
    gr.addColorStop(0, rgba('#FFE6B8', .42)); gr.addColorStop(.45, rgba('#FFE6B8', 0)); gr.addColorStop(.62, rgba('#4A3550', 0)); gr.addColorStop(1, rgba('#4A3550', .5));
    cc.fillStyle = gr; cc.fillRect(-200, -200, W + 400, H + 400);
    airbrush(cc, bx - 170, ry + 70, 230, 150, '#FFF4DC', .3, 1);
    airbrush(cc, bx + 330, ry + 150, 260, 200, '#2A1A3A', .22, 1);
    cc.restore();
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(CC, 0, 0); g.restore();
  if (o.steam != null) {
    g.save(); e.save(); g.setTransform(M); e.setTransform(M); e.globalAlpha = .35;   // 发光板只写 1/3（亮阶 30% × .35），全量写进去在 CRT 里像蜡烛火苗
    steam(g, e, o.steam, { x: bx - 10, y: ry - 2, preset: 'S10', spread: 90, lampSide: -1, seed: 1010, cfg: { n: 4, w: [32, 60], len: [220, 300], amp: 9 } });
    g.restore(); e.restore();
  }
}

// —— S10 时间线（lt 0–3）——
// 0–0.75 双手托碗推过来：切进来时碗已经在往右走（接 S9 出点碗沿高光往右滑，方向一致），头 4 张手腕往下压一下（推的劲），ease-out 停住；
// 0.75–1.25 老主顾的手右入，一拍两格 6 张：张着手进 → 四指往碗腹下扣、拇指落到碗沿 → 托住，之后多停；
// 1.25（28.25）袖口雪粒换湿点；1.5（28.5）起冻成 harmony 静帧（袖口水痕），只剩热气，匀速左摇 16 px
export const POSE10 = { master: [-178, 131], far: [-80, 128], guest: [178, 150] };   // 相对碗心 (bx, ry) 的旧锚点：近手 → 碗沿左端，远手 → 远侧碗沿，老主顾 → 碗沿右端
const GIN = [[640, 1], [420, 1], [230, .85], [90, .55], [22, .25], [0, 0]];   // 老主顾入画 6 张：[离托住位置的 x, 张开程度 op]（第一张就露出指尖和袖口）
export function draw(g, e, lt, A, t) {
  const harm = lt >= 1.5, tq = harm ? 1.5 : q12(lt);
  const dx = harm ? -16 * Math.min(1, (lt - 1.5) / 1.5) : 0;
  const pre = tq < .33 ? Math.sin(tq / .33 * Math.PI) : 0;
  const push = easeOut((tq + 1 / 12) / (.75 + 1 / 12)), bx = L.bx - 190 * (1 - push);
  const k = Math.min(5, Math.floor((tq - .75) * 12 + 1e-6)), cuff = harm ? 'streak' : tq >= 1.25 ? 'wet' : 'snow';
  scene(g, e, {
    dx, bx, harm, steam: t, glint: lt < .25 ? lt / .25 : null,
    master: [bx + POSE10.master[0], L.ry + POSE10.master[1], (90 - 3 * pre) * D],
    far: [bx + POSE10.far[0], L.ry + POSE10.far[1], -3 * pre * D],
    guest: k >= 0 ? [L.bx + POSE10.guest[0] + GIN[k][0], L.ry + POSE10.guest[1], cuff, GIN[k][1]] : null,
  });
  return {};
}
