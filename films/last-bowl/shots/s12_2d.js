// S12（33.0–36.0）中近景 · 正俯：师傅在近侧，右手从画面下沿拿湿布进来，四指扣布、掌根压着，顺一道弧把散开的面粉擦出一条干净的湿带
// → 34.5 松开扣布的四指、掌放平 → 34.875 拇指顺木纹抹一下 → 手在木纹上多停一拍 → 35.75 起 3 张把布攥起、往下沿抬出画（TREATMENT §4 S12、§5；CONTINUITY S11→S12、S12→S13）。粗剪第 2 轮。
// 机位正俯：画面下方 = 师傅那一侧（手和袖子从下沿进），上方 = 窗那一侧；木板横向铺、木纹横走；吊灯在左上，光从左上来。
// 弧带和 A' 的湿布弧痕对上：镜头停稳后屏幕上从 (435, 922) 兜到 (1294, 746)、拱向近侧；起笔在左下（布按下去），收笔在右上（布从这里离开台面），和 props.wipe 同一个方向。
// 跟摇：33.0–34.5 跟着布往右摇 300 px（ease-in-out，每帧动）→ 台面内容左移 300 px（顺着 S11 碗往左端走的方向）。手和布按 12 fps 换张。
// 开头：碗刚端走的地方留一圈淡淡的碗底水印（S11 的碗），在弧的路上，布擦过去就没了。
import { canvas, cel, path, ribbon, airbrush, mix, rgba, rng, hash, W, H, TAU } from '../lib/cel.js';
import { C, BG, LIGHT } from '../pal.js';
import { hand, digit, part, backOfHand, FW, FWK } from '../hands.js';

const PAN = 300, OX = 340, TW = W + 2 * OX;            // 台面板比画面宽，左右各多 340 px
const S = 200;                                         // 掌宽（§4.2：S12 = 200 px，描边 2.0）
const ARC = { a: [735, 922], c: [1136, 966], b: [1594, 746], w: 190 };   // 擦痕弧（台面坐标 = 停稳后的屏幕坐标 + 300）
const SHOULDER = [1700, 1900];                          // 师傅右肩（台面坐标，画外下方偏右）：前臂朝它伸出去
const LD = [-.8, -.6];                                 // 屏幕上朝灯的方向（吊灯在左上）
const WD = BG.warm, CL = C('cloth'), FL = C('flour'), CLS = mix(CL.f, CL.s, .5);
const io = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const q12 = t => Math.floor(t * 12 + 1e-6) / 12;
const lerp = (a, b, m) => a + (b - a) * m;
const D = a => a * Math.PI / 180;
const at = u => { const { a, c, b } = ARC; return [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]]; };
const tan = u => { const { a, c, b } = ARC; return Math.atan2(2 * (1 - u) * (c[1] - a[1]) + 2 * u * (b[1] - c[1]), 2 * (1 - u) * (c[0] - a[0]) + 2 * u * (b[0] - c[0])); };
const aim = (x, y) => Math.atan2(-(SHOULDER[0] - x), SHOULDER[1] - y);   // 前臂（本地 +y）指向肩膀的 rot
const toS = (x, y) => { const dx = SHOULDER[0] - x, dy = SHOULDER[1] - y, L = Math.hypot(dx, dy); return [dx / L, dy / L]; };
const RING = { c: (p => [p[0] + 6, p[1] - 12])(at(.42)), r: 78 };   // 碗底水印：在弧的路上

// —— 手型（右手、手背朝上；本地坐标：掌宽 = 1，y 向下，前臂从 +y 来；拇指在 −x，小指在 +x）——
// 一组数一个手型：四指（小 → 食）各 [根节角, 中节角, 末节角, 根节长系数, 中节长系数, 末节长系数]；拇指 [根节角, 末节角, 根节长, 末节长]；a = 前臂方向（本地，度）
// 正俯看，手指往掌心弯 = 往台面里扣：一节节变短（透视缩短），同时往中指那边收（屈指时指尖往一处聚）；
// 第 3 轮（不像机械臂）：指根不等距（食–中宽、无–小窄，小指根低一截）；每根手指每个关节都带一点弯（4–9°，各不相同，老人手微微往小指一侧偏），
// 四指张开的角度不等差；每根蜷的程度不一样（食指最直、小指最蜷）；手腕有角度：前臂不顺着手的中轴，腕往小指一侧折（a < 90）
const FBASE = [[.33, -.36], [.13, -.47], [-.10, -.51], [-.34, -.44]];
const FLEN = [[.225, .15, .125], [.2835, .189, .1575], [.306, .204, .17], [.279, .186, .155]];
const FID = ['l', 'r', 'm', 'i'];
const HP = {
  // 扣布擦：掌根压住布往前推；四指并拢扣进布里（相邻手指贴着、指尖往一处聚），近节平贴、中末节往下扣（缩短），食指最直、小指最蜷；
  // 拇指和四指分开：顺着布的左沿往前压，末节往食指那边收；腕往小指一侧折（前臂从右下来、手往前推；a 在 beat 里随弧从 76 走到 84，这里的 80 只是名义值）
  scrub: { f: [[-75, -82, -91, .95, .6, .36], [-85, -89, -94, 1, .7, .45], [-93, -89, -85, 1, .78, .52], [-101, -95, -89, 1, .85, .62]], th: [-127, -111, .36, .23], a: 80 },
  // 掌放平：四指松开、自然张开一点（张角 8° / 7° / 11°，不等差），指尖轻贴台面（中末节微缩）；拇指往外打开、末节微微往食指收
  // 每根蜷得不一样：食指最舒展，无名指、小指指尖往下扣得多一点（更短）
  flat: { f: [[-74, -80, -87, .96, .85, .74], [-85, -88, -92, 1, .9, .8], [-92, -88, -84, 1, .93, .85], [-100, -94, -90, 1, .96, .9]], th: [-134, -127, .36, .235], a: 84 },
  // 攥布抬起：四指收拢把布攥住，指尖往掌心回勾（只剩近节和一点中节），拇指压到食指旁
  grab: { f: [[-79, -88, -100, .82, .45, .18], [-86, -91, -99, .86, .5, .2], [-92, -94, -98, .9, .55, .22], [-99, -96, -95, .92, .6, .26]], th: [-118, -98, .34, .2], a: 86 },
};
// 拇指顺木纹抹（34.875 起）：四张，指腹贴着木头往外（−x）滑，末节受力微微往后翘
const THUMB = [[-134, -127, .36, .235], [-142, -139, .36, .24], [-150, -150, .36, .245], [-157, -160, .36, .25]];
const TB = [-.44, .17];   // 拇指根：靠腕的桡侧角（拇指从腕边长出来，不是从掌边插出去的木栓）
const mixP = (A, B, m) => ({ f: A.f.map((r, i) => r.map((v, j) => lerp(v, B.f[i][j], m))), th: A.th.map((v, j) => lerp(v, B.th[j], m)), a: lerp(A.a, B.a, m) });
const rotAt = (x, y, P) => aim(x, y) + D(90 - P.a);   // 前臂（本地 a 方向）指向肩膀 → 手的 rot
const tipsOf = P => P.f.map((r, i) => {   // 四根手指的指尖（本地）
  let [x, y] = FBASE[i]; for (let j = 0; j < 3; j++) { x += Math.cos(D(r[j])) * FLEN[i][j] * r[3 + j]; y += Math.sin(D(r[j])) * FLEN[i][j] * r[3 + j]; }
  return [x, y];
});
const thumbTip = th => [TB[0] + Math.cos(D(th[0])) * th[2] + Math.cos(D(th[1])) * th[3], TB[1] + Math.sin(D(th[0])) * th[2] + Math.sin(D(th[1])) * th[3]];
function pose(P) {   // 一组数 → hand() 的手型函数
  return () => {
    // 掌（手背）：桡侧不再鼓出一大块盖住拇指（那样拇指只露半截、像插在掌边的木栓）。拇指压在掌下、根在腕边：
    // 掌的桡侧边从腕角顺着拇指外沿的方向走到拇指根（L），在拇指根上横过去（这一段 hand() 不描边，见 rz），从拇指内沿（M）起收成一道虎口弯、上到食指根
    // → 腕—拇指外沿是一条连着的线，拇指和食指之间是一个 V 形虎口
    const d0 = [Math.cos(D(P.th[0])), Math.sin(D(P.th[0]))], n0 = [-d0[1], d0[0]], at2 = (t, x) => [TB[0] + d0[0] * t + n0[0] * x, TB[1] + d0[1] * t + n0[1] * x];
    // 拇指收得越拢（往食指靠），虎口的肉（第一背侧骨间肌）鼓得越高，把拇指和食指之间的缝填上 —— 不留一道细长的缝
    const bg = .035 + .045 * Math.min(1.2, Math.max(0, (P.th[0] + 140) / 20));
    const L = at2(-.02, -.145), M = at2(.12, .145), IC = [-.47, -.42], web = k => [M[0] + (IC[0] - M[0]) * k - bg * Math.sin(Math.PI * k), M[1] + (IC[1] - M[1]) * k];
    const palm = part('skin', ['W', IC, [-.28, -.50], [-.08, -.54], [.13, -.52], [.34, -.46], [.49, -.34], [.53, -.04], [.47, .30], [.37, .54, 1], [-.31, .56, 1],
      [-.31 + (L[0] + .31) * .5 - .02, .56 + (L[1] - .56) * .5], L, at2(-.1, 0), M, web(.33), web(.66)], {
      cal: [[web(.25), web(.8), [web(.8)[0] + .06, web(.8)[1]], [web(.25)[0] + .05, web(.25)[1] + .02]].map(p => [p[0] - .02, p[1]])] });   // 虎口老茧：贴着虎口边一窄条
    backOfHand(palm, FBASE.map(([x, y]) => [x + .01, y - .02]), [.02, .50], 4);
    const thumb = digit(TB, [P.th[0], P.th[1]], [P.th[2], P.th[3]], { w: .28, nail: true, back: true, id: 23 });
    const fing = P.f.map((r, i) => digit(FBASE[i], r.slice(0, 3), FLEN[i].map((l, j) => l * r[3 + j]), { w: FW * FWK[FID[i]], nail: true, back: true, id: 40 + i, cal: FID[i] === 'i' ? -1 : 0 })).flat();
    // 拇指根上那一段掌边不描边，但掌的受光高光带还沿着它画了一道浅弧 → 一小块平涂皮色盖住（不描边、不做明暗），拇指根和手背接成一片
    const joint = part('skin', [at2(0, -.12), at2(-.09, -.12), at2(-.17, -.01), at2(-.05, .13), at2(.05, .13), at2(-.06, 0)], { so: 0, ho: 0, lw: .001 });
    return { arm: { w: [.03, .53], a: P.a }, parts: [...thumb, palm, joint, ...fing] };
  };
}

// —— 台面板：暖灯木板（光池在左上，右边落进暗部）；横走木纹、板缝、几个木节 ——
function tablePlate() {
  const [c, g] = canvas(TW, H); g.translate(OX, 0);
  g.fillStyle = WD.wood; g.fillRect(-OX, 0, TW, H);
  airbrush(g, 820, 380, 1500, 1050, WD.woodHalo, .95, .85);
  airbrush(g, 2350, 700, 900, 900, WD.woodDark, .7, .9);
  const R = rng(1201);
  for (let k = 0; k < 6; k++) {
    const y0 = -150 + k * 240;
    for (let j = 0; j < 9; j++) {
      const yy = y0 + 20 + j * 24 + R() * 10, ph = R() * TAU, amp = 4 + R() * 9, wl = 500 + R() * 600;
      g.strokeStyle = rgba(WD.grain, .35 + R() * .3); g.lineWidth = 1.4 + R() * 1.4; g.beginPath();
      for (let x = -OX; x <= W + OX; x += 24) { const y = yy + amp * Math.sin(x / wl * TAU + ph); x === -OX ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    if (R() < .7) { const kx = -200 + R() * 2200, ky = y0 + 60 + R() * 120; g.strokeStyle = rgba(WD.grain, .6); g.lineWidth = 2;
      for (let r = 0; r < 3; r++) { g.beginPath(); g.ellipse(kx, ky, 46 - r * 13, 11 - r * 3, 0, 0, TAU); g.stroke(); } }
    g.fillStyle = rgba(WD.woodDark, .55); g.fillRect(-OX, y0 + 236, TW, 9);
    g.fillStyle = WD.grain; g.fillRect(-OX, y0 + 234, TW, 3);
    g.fillStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .4), .5); g.fillRect(-OX, y0 + 231, TW, 2);
  }
  return c;
}
// —— 面粉层：散开的粉——沿弧一带撒开（横向近似高斯），几十小撮碎边粉 + 上千粒小粉点；碗底那一圈是空的（碗刚在那儿立着）——
const blob = (x, y, r, sd, sq = 1) => { const p = [], n = 9 + Math.floor(hash(sd) * 6); for (let i = 0; i < n; i++) { const a = i / n * TAU + hash(sd + i) * .5, k = .5 + .6 * hash(sd + i * 1.9); p.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * sq, hash(sd + i * 2.3) < .55 ? 1 : 0]); } return p; };
function flourPlate() {
  const [c, g] = canvas(TW, H); g.translate(OX, 0);
  const R = rng(3303), near = sp => { const u = -.12 + R() * 1.24, p = at(u), n = tan(u) + Math.PI / 2, d = (R() + R() + R() - 1.5) * sp; return [p[0] + Math.cos(n) * d, p[1] + Math.sin(n) * d]; };
  const free = (x, y, r) => Math.hypot(x - RING.c[0], y - RING.c[1]) > RING.r + 16 + r;
  // 薄粉层：几百个小团在离屏上满涂成一片（外沿碎边），再按透明度压上来 → 一层平涂的薄粉，木纹隐约透出来；两层叠出中间厚、边上薄
  const dust = (n, sp, r0, r1, a, sd) => {
    const [dc, dg] = canvas(TW, H); dg.translate(OX, 0); dg.fillStyle = FL.f;
    for (let i = 0; i < n; i++) { const [x, y] = near(sp), r = r0 + (r1 - r0) * R() ** 1.5; if (free(x, y, r * .5)) dg.fill(path(blob(x, y, r, sd + i * 3.7, .55 + .4 * R()), true, .5)); }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.drawImage(dc, 0, 0); g.restore();
  };
  dust(900, 125, 7, 26, .48, 900);
  dust(420, 72, 5, 18, .5, 2900);
  for (let i = 0; i < 34; i++) {   // 几小堆没撒开的粉：小、碎边，背光一侧（右下）一道硬边影
    const [x, y] = near(80), r = 3 + 8 * R() ** 2;
    if (free(x, y, r)) cel(g, blob(x, y, r, 50 + i * 7.3, .6 + .3 * R()), { f: FL.f, s: mix(FL.f, FL.s, .5), so: [-2, -2] });
  }
  g.fillStyle = FL.f;   // 散粒：外沿一圈越往外越稀
  for (let i = 0; i < 1700; i++) { const [x, y] = near(215), r = .8 + 2.2 * R() ** 2; if (free(x, y, 0)) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }
  return c;
}
let PLT = null;
const plates = () => PLT || (PLT = { table: tablePlate(), flour: flourPlate() });

// 擦过的弧带（台面坐标）：0 … u 一段，起笔钝圆（布按下去），两边随布褶不规则起伏
function swept(u) {
  const sp = [], n = Math.max(2, Math.round(u * 48));
  for (let i = 0; i <= n; i++) sp.push(at(u * i / n));
  return path(ribbon(sp, s => ARC.w * Math.min(1, Math.sqrt(s * u / .03 + .1)) * (.9 + .05 * Math.sin(s * u * 31) + .06 * hash(Math.round(s * u * 48)))), true, .5);
}
// 布推到两边的一道粉埂：沿弧两侧一小撮一小撮（有断口），只画擦过的那段
function berm(g, u) {
  for (let i = 0; i < 70; i++) {
    const s = i / 70; if (s > u - .02) break;
    for (const sd of [-1, 1]) {
      if (hash(i * 3.1 + sd) < .3) continue;
      const p = at(s), n = tan(s) + Math.PI / 2, d = ARC.w * .5 * (.92 + .1 * hash(i + sd * 7)) + 4 + 6 * hash(i * 1.3 + sd), r = 3 + 6 * hash(i * 5.7 + sd);
      cel(g, blob(p[0] + Math.cos(n) * d * sd, p[1] + Math.sin(n) * d * sd, r, 300 + i * 11 + sd, .7), { f: FL.f, s: mix(FL.f, FL.s, .5), so: [-2, -2] });
    }
  }
}
// 碗底水印：一圈淡淡的湿木头（一处断口：碗是斜着端起来的），朝灯一侧一道细水光
function ring(g) {
  const [x, y] = RING.c, r = RING.r;
  g.lineCap = 'round';
  g.strokeStyle = rgba(WD.woodDark, .3); g.lineWidth = 10; g.beginPath(); g.arc(x, y, r, .5, .5 + TAU * .9); g.stroke();
  g.strokeStyle = rgba(WD.woodDark, .14); g.lineWidth = 6; g.beginPath(); g.arc(x + 3, y + 2, r - 11, 0, TAU); g.stroke();
  g.strokeStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .55), .55); g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r - 4, 3.5, 4.9); g.stroke();
}

// —— 湿布（手的本地坐标，掌宽 = 1，跟手一起转）：对折的一块压在掌下，左后方拖一个布角；擦的时候指尖前面的布被扣出几道放射的拉褶 ——
const CLOTH = [[-.74, -.98], [-.45, -1.1, 1], [-.12, -1.04], [.2, -1.12, 1], [.52, -1.02], [.76, -.9, 1], [.82, -.4], [.74, .1, 1], [.8, .42], [.5, .56, 1], [.1, .5], [-.3, .58, 1], [-.64, .46], [-.8, .12, 1], [-.78, -.42]];
function cloth(g, x, y, rot, s, o) {
  const cr = Math.cos(rot), sr = Math.sin(rot), X = p => [x + (p[0] * cr - p[1] * sr) * s, y + (p[0] * sr + p[1] * cr) * s, p[2]];
  const sq = o.bunch ?? 1, B = CLOTH.map(([px, py, k]) => X([px * sq, py * (.6 + .4 * sq) - .1 * (1 - sq), k]));
  const wv = o.wave ?? 0, hang = o.hang ?? 0;   // 布角：12 fps 微微摆；抬起时往下垂
  const flap = [[-.6, .28], [-.92, .4 + .04 * wv], [-1.2 - .1 * hang, .58 + .05 * wv + .3 * hang, 1], [-1.08 - .06 * hang, .74 + .35 * hang], [-.84, .8 + .2 * hang, 1], [-.46, .56]].map(X);
  const lift = o.lift ?? 0;
  g.save(); g.translate(7 + 40 * lift, 6 + 30 * lift); g.fillStyle = rgba(WD.woodDark, .42); g.fill(path(flap)); g.fill(path(B)); g.restore();   // 布投在台面上的影
  cel(g, flap, { f: CL.f, s: CLS, so: [-4, -3], sh: [[[-.66, .4], [-1.0, .55], [-1.1, .66], [-.7, .5]].map(X)], l: CL.l, lw: 2 });
  const sh = [[[-.5, -1.0], [-.4, -1.02], [-.22, -.3], [-.32, .34], [-.42, .32], [-.32, -.3]].map(X),   // 一道斜折
    [[.58, -.98], [.66, -.95], [.7, .3], [.62, .32]].map(X)];                                             // 对折的那条边：两层布叠着
  if (o.tips) for (const [tx, ty] of o.tips) sh.push([[tx - .03, ty - .02], [tx + .03, ty - .02], [tx + .05 * Math.sign(tx), ty - .2], [tx + .02 * Math.sign(tx), ty - .24]].map(X));   // 指尖扣出的拉褶
  cel(g, B, { f: CL.f, s: CLS, so: [-5, -4], sh, h: CL.h, hi: [[[-.62, -.96], [-.42, -1.06], [-.36, -.98], [-.56, -.9]].map(X), [[-.74, -.3], [-.7, .1], [-.64, .08], [-.68, -.3]].map(X)], l: CL.l, lw: 2 });
}
// 指尖前面被扣起来的一道布褶：盖住四个指尖（四指扣进布里）
function roll(g, x, y, rot, s, tips) {
  const cr = Math.cos(rot), sr = Math.sin(rot), X = p => [x + (p[0] * cr - p[1] * sr) * s, y + (p[0] * sr + p[1] * cr) * s, p[2]];
  const T = [...tips].sort((p, q) => p[0] - q[0]), back = [], front = [];
  T.forEach((p, i) => { back.push([p[0], p[1] + .025]); if (i < T.length - 1) { const q = T[i + 1]; back.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + .09, 1]); } });   // 只盖住指尖一小截：手指扣进布里，不是套了手套
  T.forEach(p => front.push([p[0] - .05, p[1] - .1, 1], [p[0] + .05, p[1] - .12]));
  const pts = [[T[0][0] - .15, T[0][1] + .01, 1], ...back, [T[3][0] + .13, T[3][1] + .03, 1], ...front.reverse()].map(X);
  cel(g, pts, { f: CL.f, s: CLS, so: [-4, -3], sh: T.slice(0, 3).map((p, i) => [[(p[0] + T[i + 1][0]) / 2, (p[1] + T[i + 1][1]) / 2 + .1], [(p[0] + T[i + 1][0]) / 2 + .03, (p[1] + T[i + 1][1]) / 2 - .02], [(p[0] + T[i + 1][0]) / 2 - .02, (p[1] + T[i + 1][1]) / 2 - .08]].map(X)), h: CL.h, hi: T.map(p => [[p[0] - .06, p[1] - .07], [p[0] + .02, p[1] - .1], [p[0], p[1] - .06]].map(X)), l: CL.l, lw: 2 });
}

// 手（含投影）：先画到离屏，投影 = 同一剪影染成暗部色，往背光方向（右下）偏；抬得越高偏得越远
let HC = null;
function handAt(g, x, y, rot, k, lift, P) {
  if (!HC) HC = { a: canvas(W, H), b: canvas(W, H) };
  const [hc, hg] = HC.a, [sc, sg] = HC.b;
  hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, W, H);
  hand(hg, null, { x, y, s: S * k, rot, side: 'R', pose: pose(P), light: 'warm', ld: LD, arm: 5 });
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W, H); sg.drawImage(hc, 0, 0);
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = WD.woodDark; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'source-over';
  g.save(); g.globalAlpha = .45; g.drawImage(sc, 12 + 46 * lift, 9 + 34 * lift); g.restore();
  g.drawImage(hc, 0, 0);
}

// 这一张：手（台面坐标的掌心）、手型、缩放、抬起，擦到哪（u），布怎么画
function beat(lq) {
  const { b } = ARC;
  if (lq < .25) {                                                          // 33.0–33.25：从下沿拿着布进来（3 张），落到起笔处
    const i = Math.round(lq * 12), d = [560, 250, 70][i], a = at(0), v = toS(a[0], a[1]);
    return { u: 0, h: [a[0] + v[0] * d, a[1] + v[1] * d], P: { ...HP.scrub, a: 76 }, k: [1.12, 1.07, 1.02][i], lift: [1.6, 1, .4][i], grip: 1 };
  }
  if (lq < 1.5) { const u = io((lq - .25) / 1.25); return { u, h: at(u), P: { ...HP.scrub, a: lerp(76, 84, u) }, k: 1, lift: 0, grip: 1 }; }   // 33.25–34.5：扣布、掌根压着顺弧擦；腕跟着弧慢慢回正（往小指一侧折 14° → 6°）
  if (lq < 1.75) { const m = [.35, .7, 1][Math.round((lq - 1.5) * 12)]; return { u: 1, h: b, P: mixP({ ...HP.scrub, a: 84 }, HP.flat, m), k: 1, lift: .3 * (1 - m), grip: m < .5 ? 1 : 0 }; }   // 松开四指、放平（3 张）
  if (lq < 2.75) { const ti = lq < 1.875 ? 0 : Math.min(3, Math.round((lq - 1.875) * 12) + 1); return { u: 1, h: b, P: { ...HP.flat, th: THUMB[ti] }, k: 1, lift: 0, ti }; }   // 掌平放；拇指顺木纹抹，停一拍
  const i = Math.min(2, Math.round((lq - 2.75) * 12)), v = toS(b[0], b[1]), d = [70, 340, 720][i];      // 35.75 起 3 张：攥起布、往下沿抬出画
  return { u: 1, h: [b[0] + v[0] * d, b[1] + v[1] * d], P: mixP({ ...HP.flat, th: THUMB[3] }, HP.grab, [.55, 1, 1][i]), k: [1.05, 1.13, 1.22][i], lift: [.8, 1.8, 2.8][i], ti: 3, out: i + 1 };
}

export function draw(g, e, lt, A, t) {
  const { table, flour } = plates();
  const pan = -PAN * io(Math.min(1, lt / 1.5)), lq = q12(lt), B = beat(lq);
  g.drawImage(table, pan - OX, 0);
  const sw = swept(B.u), hole = new Path2D();
  hole.rect(-OX - 10, -10, TW + 20, H + 20); if (B.u > 0) hole.addPath(sw);
  g.save(); g.translate(pan, 0);
  g.save(); g.clip(hole, 'evenodd'); ring(g); g.drawImage(flour, -OX, 0); g.restore();   // 面粉和碗底水印：扣掉擦过的弧带
  if (B.u > 0) {
    g.fillStyle = rgba(WD.woodDark, .24); g.fill(sw);                                  // 湿痕：深一档的木头
    const glint = (off, t0, t1, wpx) => { if (B.u <= t0) return; const sp = []; for (let i = 0; i <= 20; i++) { const s = t0 + (Math.min(t1, B.u) - t0) * i / 20, p = at(s), n = tan(s) + Math.PI / 2; sp.push([p[0] + Math.cos(n) * off * ARC.w, p[1] + Math.sin(n) * off * ARC.w]); } g.fill(path(ribbon(sp, s => wpx * Math.sqrt(Math.sin(Math.PI * s))))); };
    g.fillStyle = rgba(mix(LIGHT.warm, WD.woodHalo, .3), .8); glint(-.22, .1, .3, 4); glint(-.3, .38, .55, 3.5); glint(.12, .62, .8, 4);
    berm(g, B.u);
  }
  if (B.ti >= 2) {                                                                     // 拇指抹过的一道亮痕（顺木纹，横走）
    const r = rotAt(...ARC.b, HP.flat), tip = th => { const p = thumbTip(th); return [ARC.b[0] + (p[0] * Math.cos(r) - p[1] * Math.sin(r)) * S, ARC.b[1] + (p[0] * Math.sin(r) + p[1] * Math.cos(r)) * S]; };
    const p0 = tip(THUMB[1]), p1 = tip(THUMB[Math.min(3, B.ti)]);
    g.strokeStyle = rgba(mix(WD.woodHalo, LIGHT.warm, .55), .75); g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(p0[0] + 8, p0[1]); g.lineTo(p1[0], p1[1] + 2); g.stroke();
  }
  // 布 + 手（台面坐标 → 屏幕：x 加 pan）
  const [hx, hy] = B.h, rot = rotAt(hx, hy, B.P), x = hx + pan, wv = Math.sin(lq * 12 * 1.9);
  g.restore();
  const tips = tipsOf(B.P), s = S * B.k;
  if (B.out) cloth(g, x, hy, rot, s, { bunch: .62, hang: B.out / 3, lift: B.lift, wave: wv });
  else cloth(g, x, hy, rot, s, { tips: B.grip ? tips : null, lift: B.lift, wave: B.u < 1 ? wv : 0 });
  handAt(g, x, hy, rot, B.k, B.lift, B.P);
  if (B.grip || B.out) roll(g, x, hy, rot, s, tips);   // 抬出画时四指攥着的那团布从指尖下鼓出来：攥着布，不是空拳
  return {};
}
