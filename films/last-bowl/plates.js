// plates.js —— 背景画师：主构图 A 的三张背景板（暖灯 / 灯灭光斑内 / 灯灭光斑外）+ S5 仰拍板。
// 背景板走喷枪渐变，加载时画一次；每张配一张发光板 e（只放自己发光的：路灯照亮的雪、路灯光晕、S5 吊灯光晕）。
// 位置全部从 layout.js 的 w2s 反推（逐行二分求世界坐标），颜色全部取自 pal.js。
import { canvas, W, H, TAU, mix, rgba, hex, rng, hash } from './lib/cel.js';
import { w2s, scale, WIN, TABLE, LAMP_STREET, SHADE, HALO, OBJ, spot } from './layout.js';
import { BG, SNOW, LIGHT, CORE } from './pal.js';

const STREET_Y = LAMP_STREET[1] - 7;                          // 街面：路灯离街面 7 m（§4.1）→ −0.75
const BULB = [SHADE.c[0], SHADE.c[1] + 0.06, SHADE.c[2]];      // 灯泡在罩口里 6 cm

// —— 小工具 ——
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function inv(f, target, lo, hi) {            // f 在 [lo, hi] 单调，二分求 f(x) = target
  const up = f(hi) > f(lo);
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if ((f(m) < target) === up) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// 某一屏幕行落在竖直面 z = Z / 水平面 y = Y 上：返回该行的世界 y（或 z），以及 sx = c + k·x
const rowOnZ = (P, Z, sy, lo, hi) => { const v = inv(u => P(0, u, Z)[1], sy, lo, hi), c = P(0, v, Z)[0]; return { v, c, k: P(1, v, Z)[0] - c }; };
const rowOnY = (P, Y, sy, lo, hi) => { const v = inv(u => P(0, Y, u)[1], sy, lo, hi), c = P(0, Y, v)[0]; return { v, c, k: P(1, Y, v)[0] - c }; };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  const h = (p, q) => hash(p * 57.31 + q * 113.7);
  return (h(xi, yi) * (1 - a) + h(xi + 1, yi) * a) * (1 - b) + (h(xi, yi + 1) * (1 - a) + h(xi + 1, yi + 1) * a) * b;
}
const fbm = (x, y) => vnoise(x, y) * .6 + vnoise(x * 2.7 + 5.1, y * 2.7 + 1.3) * .4;
function ramp(stops) {                       // 喷枪色带：t → rgb（写进 o）
  const S = stops.map(([t, c]) => [t, hex(c)]);
  return (t, o) => {
    let i = 0; while (i < S.length - 2 && t > S[i + 1][0]) i++;
    const [t0, a] = S[i], [t1, b] = S[i + 1], u = clamp((t - t0) / (t1 - t0));
    o[0] = a[0] + (b[0] - a[0]) * u; o[1] = a[1] + (b[1] - a[1]) * u; o[2] = a[2] + (b[2] - a[2]) * u;
  };
}
const mixInto = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };
function put(d, k, o, i, j, a = 255) {       // 写像素 + 确定性抖动（防喷枪渐变出色阶）
  const n = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 997 / 997 * 2.4 - 1.2;
  d[k] = o[0] + n; d[k + 1] = o[1] + n; d[k + 2] = o[2] + n; d[k + 3] = a;
}
const wpath = (P, pts) => { const p = new Path2D(); pts.forEach((q, i) => { const [x, y] = P(...q); i ? p.lineTo(x, y) : p.moveTo(x, y); }); p.closePath(); return p; };

// —— 色板（全部取自 pal.js，中间色用 mix 调）——
const RGB = {
  ind: hex(BG.night.indigo), grey: hex(BG.night.snowGrey), gold: hex(BG.night.lampGold), mid: hex(SNOW.mid),
  lsnow: hex(SNOW.lampSnow), haze: hex(mix(BG.night.indigo, BG.night.snowGrey, .38)), warm: hex(LIGHT.warm),
};
const SET = {
  warm: {
    wall: ramp([[0, BG.warm.woodDark], [.25, BG.warm.wallFar], [.6, mix(BG.warm.wallFar, BG.warm.wallNear, .55)], [.95, BG.warm.wallNear], [1.25, mix(BG.warm.wallNear, LIGHT.warm, .45)]]),
    table: ramp([[0, BG.warm.woodDark], [.55, BG.warm.wood], [.95, BG.warm.woodHalo], [1.2, mix(BG.warm.woodHalo, LIGHT.warm, .3)]]),
    face: ramp([[0, mix(BG.warm.woodDark, BG.warm.grain, .4)], [.6, mix(BG.warm.wood, BG.warm.woodDark, .45)], [1, BG.warm.woodHalo]]),
    grain: BG.warm.grain, hi: BG.warm.woodHalo,
  },
  out: {
    wall: ramp([[0, mix(BG.dark.wallFar, BG.dark.grain, .35)], [.3, BG.dark.wallFar], [1, BG.dark.wallNear]]),
    table: ramp([[0, BG.dark.woodDark], [1, BG.dark.woodOut]]),
    face: ramp([[0, mix(BG.dark.woodDark, BG.dark.grain, .5)], [.7, BG.dark.woodDark], [1, BG.dark.woodOut]]),
    grain: BG.dark.grain, hi: BG.dark.woodIn,
  },
};
SET.in = { ...SET.out, table: ramp([[0, mix(BG.dark.woodIn, BG.dark.woodOut, .5)], [1, BG.dark.woodIn], [1.25, mix(BG.dark.woodIn, LIGHT.in, .3)]]), hi: mix(BG.dark.woodIn, LIGHT.in, .4) };

// —— 主构图 A：逐行反投影表（一次算好，三张板共用）——
let ROWS = null;
const yOf = (y, z) => w2s(0, y, z)[1];
function rowsA() {
  if (ROWS) return ROWS;
  const yBack = yOf(TABLE.y, WIN.z), yFront = yOf(TABLE.y, TABLE.z0), wTop = yOf(WIN.y1, WIN.z), wBot = yOf(WIN.y0, WIN.z);
  ROWS = [];
  for (let j = 0; j < H; j++) {
    const sy = j + .5, r = {};
    if (sy < yBack) {
      r.wall = rowOnZ(w2s, WIN.z, sy, -3, 3.5);
      if (sy > wTop - 2 && sy < wBot + 2) r.street = rowOnY(w2s, STREET_Y, sy, .05, 200);
    } else if (sy < yFront) r.table = rowOnY(w2s, TABLE.y, sy, .05, 50);
    else r.face = rowOnZ(w2s, TABLE.z0, sy, -3, 2.9);
    ROWS.push(r);
  }
  return ROWS;
}

// —— 窗外雪夜街面（y = −0.75）。机位俯 40°：窗里从下往上是越来越远的地面，没有天空 ——
// 近侧人行道（窗台下 z 3.8 起，雪青灰）→ 近路沿 4.8 → 车道（压实的雪暗一档，两道车辙）→ 对面路沿 7.2 → 对面人行道 → 对街门脸墙根 8.0（只露离地 0–0.65 m）
// 颜色只在 靛蓝 → 雪青灰 → 亮雪 这条线上走；路灯金只留给杆脚一小圈和雪堆顶上一线（第 3 轮评委：窗外暖色的面积和亮度要压在红碗沿以下）
const ST = { curbN: 4.8, curbF: 7.2, fac: 8.0, tracks: [5.35, 6.75] };
const facHit = z => { const s = ST.fac / z; return [2.3 + (STREET_Y - 2.3) * s - STREET_Y, s]; };   // 视线越过墙根：撞墙的离地高、x 缩放
function street(x, z, o) {                    // 逐像素底色（喷枪层）；路沿、光池、脚印、门脸细节另用硬边形画在上面
  let v, far;
  if (z > ST.fac) {                           // 对街墙根：暗靛，正对路灯的一段微微提亮，离地 0.3 m 以下是墙裙
    const [hf, s] = facHit(z), xf = x * s;
    v = .07 + .1 / (1 + ((xf - LAMP_STREET[0]) / 2.4) ** 2) + .04 * (fbm(xf * 1.3, hf * 4) - .5) - (hf < .3 ? .03 : 0); far = 1;
  } else {
    // 窗的下半（z < 5.8）是雪地：窗台下雪青灰 #8C93B8，往上很快沉进靛蓝夜色（暖灯 A 的窗外仍是靛蓝夜，别回退）
    far = clamp((z - 3.8) / 4.2);
    v = .12 + .88 * Math.exp(-(((z - 3.8) / 1.6) ** 1.5)) + .06 * (fbm(x * .8, z * 2.2) - .5) + .03 * (vnoise(x * 5, z * 9) - .5);
    if (z > ST.curbN && z < ST.curbF) {       // 车道：压实的雪暗一档；两道车辙（轮距 1.4 m），时断时续，辙边挤出一线松雪
      v -= .08;
      for (const zc of ST.tracks) {
        const u = Math.abs(z - zc - .05 * Math.sin(x * .6 + zc) - .02 * Math.sin(x * 2.3)) / .075, on = sstep(.35, .5, fbm(x * .9 + zc, zc));
        v += on * (-.07 * (1 - sstep(.85, 1.1, u)) + .025 * (sstep(1, 1.2, u) - sstep(1.6, 2, u)));
      }
    }
  }
  const [a, b, t] = v <= 1 ? [RGB.ind, RGB.grey, v] : [RGB.grey, RGB.mid, v - 1];
  o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t;
  mixInto(o, RGB.haze, far * .15);            // 远处隔着落雪略灰
}
// 街面 / 对街墙面上的点 → 屏幕；地面上的椭圆和多边形
const SP = (x, z) => w2s(x, STREET_Y, z), FP = (x, h) => w2s(x, STREET_Y + h, ST.fac);
function shape(P, pts) { const p = new Path2D(); pts.forEach(([a, b], i) => { const [sx, sy] = P(a, b); i ? p.lineTo(sx, sy) : p.moveTo(sx, sy); }); p.closePath(); return p; }
const ellPts = (cx, cz, rx, rz, n = 40, rot = 0) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, u = Math.cos(a) * rx, w = Math.sin(a) * rz; return [cx + u * Math.cos(rot) - w * Math.sin(rot), cz + u * Math.sin(rot) + w * Math.cos(rot)]; });
const band = (P, x0, x1, f0, f1, n = 48) => shape(P, [...Array.from({ length: n + 1 }, (_, i) => { const x = x0 + (x1 - x0) * i / n; return [x, f0(x)]; }), ...Array.from({ length: n + 1 }, (_, i) => { const x = x1 - (x1 - x0) * i / n; return [x, f1(x)]; })]);
const POOL = { lit: mix(BG.night.snowGrey, SNOW.mid, .5), core: mix(mix(BG.night.snowGrey, SNOW.mid, .5), SNOW.lampSnow, .42) };   // core ≈ #CEC7BF：偏金的亮雪，低饱和

// 窗里看到的街：对街门脸底部 → 路沿 → 杆脚光池 → 脚印 → 路灯杆 → 杆脚雪堆（都裁在窗洞里，两种光照相同）
function streetDetails(g, e) {
  const dk = mix(BG.dark.grain, BG.night.indigo, .45), steel = mix(BG.night.indigo, BG.night.snowGrey, .13), farSnow = mix(BG.night.indigo, BG.night.snowGrey, .5);
  // 1) 对街：左边一家卷帘门落着（底杠上挂锁）、中间木门和石台阶、落水管、右边一家的矮墙橱窗；墙根一溜积雪
  g.fillStyle = steel; g.fill(shape(FP, [[-4.0, .15], [-1.3, .15], [-1.3, 1], [-4.0, 1]]));
  for (let h = .2; h < .7; h += .11) {        // 板条 11 cm（屏幕约 16 px，避开扫描线 3 px 的整数倍）
    const a = FP(-4.0, h), b = FP(-1.3, h); g.fillStyle = rgba(BG.dark.grain, .55); g.fillRect(a[0], a[1] - 1, b[0] - a[0], 1.4);
    g.fillStyle = rgba(BG.night.snowGrey, .2); g.fillRect(a[0], a[1] + 1, b[0] - a[0], 1);
  }
  g.fillStyle = dk; g.fill(shape(FP, [[-4.0, .15], [-1.3, .15], [-1.3, .2], [-4.0, .2]]));
  g.fillStyle = BG.dark.grain; g.fill(shape(FP, [[-2.68, .08], [-2.6, .08], [-2.6, .15], [-2.68, .15]]));   // 挂锁
  g.fillStyle = mix(BG.night.indigo, BG.night.snowGrey, .22); g.fill(shape(FP, [[-4.1, 0], [-1.2, 0], [-1.2, .15], [-4.1, .15]]));   // 门前水泥台
  g.fillStyle = mix(mix(BG.warm.grain, BG.night.indigo, .6), BG.dark.grain, .35); g.fill(shape(FP, [[.15, .17], [1.05, .17], [1.05, 1], [.15, 1]]));   // 木门（暗，不跳）
  g.fillStyle = rgba(BG.night.snowGrey, .08); g.fill(shape(FP, [[.2, .19], [1.0, .19], [1.0, .34], [.2, .34]]));               // 踢脚板
  g.fillStyle = mix(BG.night.indigo, BG.night.snowGrey, .25); g.fill(shape(FP, [[-.05, 0], [1.25, 0], [1.25, .16], [-.05, .16]]));   // 石台阶
  g.fillStyle = farSnow; g.fill(shape(FP, [[-.05, .14], [1.25, .14], [1.25, .17], [-.05, .17]]));
  g.fillStyle = dk; g.fill(shape(FP, [[-.62, 0], [-.53, 0], [-.53, 1], [-.62, 1]]));                                       // 落水管（在卷帘门和木门之间，不和路灯杆并排）
  g.fillStyle = rgba(BG.night.snowGrey, .3); g.fill(shape(FP, [[-.62, .02], [-.6, .02], [-.6, 1], [-.62, 1]]));
  g.fillStyle = mix(BG.night.indigo, BG.dark.grain, .3); g.fill(shape(FP, [[2.3, 0], [4.6, 0], [4.6, .46], [2.3, .46]]));   // 右边一家的矮墙
  g.fillStyle = mix(BG.dark.grain, BG.night.indigo, .7); g.fill(shape(FP, [[2.35, .5], [4.6, .5], [4.6, 1], [2.35, 1]]));   // 黑着的橱窗
  g.fillStyle = farSnow; g.fill(shape(FP, [[2.3, .45], [4.6, .45], [4.6, .5], [2.3, .5]]));                               // 窗台上的雪
  const drift = x => .05 + .07 * fbm(x * 1.7 + 4, 2) * (x > -.1 && x < 1.3 ? 0 : 1);
  g.fillStyle = mix(BG.night.indigo, BG.night.snowGrey, .32); g.fill(band(FP, -4.6, 4.8, () => 0, drift, 120));   // 墙根积雪：远，暗一档
  // 2) 路沿：对面路沿的立面朝着机位、被路灯照亮一点；近路沿只见沿口一线亮 + 落差一线暗，被积雪埋断几处
  g.fillStyle = mix(BG.night.indigo, BG.night.snowGrey, .2); g.fill(band((x, h) => w2s(x, STREET_Y + h, ST.curbF), -5, 5, () => 0, x => .1 + .03 * fbm(x * 3, 4)));
  // 近路沿：铲到车道这侧的一溜雪埂（上沿起伏、宽窄不一），埂背后一线暗 —— 不是一条直的「地平线」；只在几段露出沿口
  const ridgeTop = x => ST.curbN + .1 + .07 * fbm(x * 2.2, 7) + .03 * Math.sin(x * 5.3);
  g.fillStyle = rgba(mix(BG.night.snowGrey, SNOW.mid, .2), .4); g.fill(band(SP, -3.2, 3.2, x => ST.curbN - .02 + .03 * fbm(x * 3.1, 2), ridgeTop, 96));
  g.fillStyle = rgba(BG.night.indigo, .42); g.fill(band(SP, -3.2, 3.2, ridgeTop, x => ridgeTop(x) + .035, 96));
  for (let x = -2.4; x < 2.6; x += .55) {
    if (fbm(x * 3, 9) < .5) continue;                                   // 大半段被雪埋着，只露几截沿口
    g.fillStyle = rgba(BG.dark.grain, .45); g.fill(band(SP, x, x + .3, () => ST.curbN - .012, () => ST.curbN + .012, 6));
  }
  // 3) 杆脚光池：以杆脚为心的透视扁椭圆（喷枪，背景板许可）：芯里淡淡的路灯金（低饱和、面积小，压在红碗沿之下），外圈是被照亮的冷雪
  const [LX0, , LZ0] = LAMP_STREET, [cx0, cy0] = SP(LX0, LZ0), prx = 1.25 * scale(LX0, STREET_Y, LZ0);
  g.save(); g.translate(cx0, cy0); g.scale(1, .34);
  const pg = g.createRadialGradient(0, 0, 0, 0, 0, prx);
  for (const [t, c, a] of [[0, POOL.core, .85], [.18, POOL.core, .7], [.36, POOL.lit, .5], [.7, POOL.lit, .16], [1, POOL.lit, 0]]) pg.addColorStop(t, rgba(c, a));
  g.fillStyle = pg; g.beginPath(); g.arc(0, 0, prx, 0, TAU); g.fill(); g.restore();
  // 4) 脚印：一串从窗下往右后方斜穿马路（老主顾走了），越远越小、越被新雪填平
  for (let i = 0; i < 16; i++) {
    const u = i / 15, cx = -1.1 + 1.9 * u + .25 * Math.sin(u * 2.2), cz = 3.95 + 3.45 * u, dx = 1.9 + .55 * Math.cos(u * 2.2), dz = 3.45;
    const ang = Math.atan2(dz, dx), side = i % 2 ? 1 : -1, ox = -Math.sin(ang) * .09 * side, oz = Math.cos(ang) * .09 * side, fade = 1 - u * .6;
    g.fillStyle = rgba(BG.night.indigo, .3 * fade); g.fill(shape(SP, ellPts(cx + ox, cz + oz, .11, .04, 14, ang)));
    g.fillStyle = rgba(SNOW.mid, .22 * fade); g.fill(shape(SP, ellPts(cx + ox + Math.cos(ang) * .07, cz + oz + Math.sin(ang) * .07, .035, .028, 10, ang)));   // 脚尖踢起的一点雪
  }
  // 5) 路灯杆：一直落到地上的雪堆里（灯头在窗上沿之外看不到）；暗靛蓝，左边一线雪光，迎风的右边糊着一条雪
  const [px, pz, pr] = [LX0, LZ0, .065], top = 1.4;
  const pole = shape((x, y) => w2s(x, y, pz), [[px - pr, top], [px + pr, top], [px + pr, STREET_Y], [px - pr, STREET_Y]]);
  g.fillStyle = mix(BG.dark.grain, BG.night.indigo, .55); g.fill(pole); e.fillStyle = '#000'; e.fill(pole);
  g.fillStyle = rgba(BG.night.snowGrey, .55); g.fill(shape((x, y) => w2s(x, y, pz), [[px - pr, top], [px - pr + .018, top], [px - pr + .018, STREET_Y], [px - pr, STREET_Y]]));
  g.fillStyle = mix(BG.night.snowGrey, SNOW.mid, .25); g.beginPath();
  for (let n = 0; n <= 30; n++) { const y = STREET_Y + n / 30 * (top - STREET_Y), [sx, sy] = w2s(px + pr - .008 - .01 * fbm(y * 9, 2), y, pz); n ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }
  for (let n = 30; n >= 0; n--) { const y = STREET_Y + n / 30 * (top - STREET_Y), [sx, sy] = w2s(px + pr + .004, y, pz); g.lineTo(sx, sy); }
  g.fill();
  // 6) 杆脚积雪（r5 导演：原来的圆包 + 亮帽 + 金边像第二个灯头）：宽而矮的一堆，几块大小不一的雪挤在杆脚、杆边最高，
  //    轮廓是几段弧拼出的凹凸（不是一圈圆沿）；和街上的雪同一族色，不描金边。路灯的光只在雪面上喷一块淡金椭圆
  const ZH = pz - .02, LUMPS = [[-.2, .045, .085], [-.1, .08, .095], [0, .12, .08], [.09, .075, .085], [.19, .055, .09], [.28, .025, .065]];
  const hAt = x => Math.max(0, ...LUMPS.map(([c, h, w]) => { const u = (x - px - c) / w; return u * u < 1 ? h * Math.sqrt(1 - u * u) : 0; })) * (.9 + .1 * fbm(x * 30, 3));
  const NP = 64, xs = n => px - .28 + .61 * n / NP, PZ = (x, y) => w2s(x, y, ZH);
  const crest = Array.from({ length: NP + 1 }, (_, n) => [xs(n), STREET_Y + hAt(xs(n))]);
  const foot = Array.from({ length: NP + 1 }, (_, n) => { const x = xs(NP - n), u = (x - px - .025) / .305; return SP(x, pz - .02 - .03 * Math.sqrt(Math.max(0, 1 - u * u)) * (.8 + .2 * fbm(x * 12, 6))); });
  const pathOf = top => { const p = new Path2D(); top.forEach(([x, y], n) => { const [sx, sy] = PZ(x, y); n ? p.lineTo(sx, sy) : p.moveTo(sx, sy); }); foot.forEach(([sx, sy]) => p.lineTo(sx, sy)); p.closePath(); return p; };
  const pile = pathOf(crest);
  g.fillStyle = mix(SNOW.mid, BG.night.snowGrey, .3); g.fill(pile); e.fillStyle = '#000'; e.fill(pile);      // 堆顶朝天、迎着头顶的路灯：比地上的雪亮一点
  g.fillStyle = mix(BG.night.snowGrey, BG.night.indigo, .12);                                                  // 贴地的陡坡朝机位、背灯：暗一档，上沿随雪块起伏
  g.fill(pathOf(crest.map(([x, y], n) => [x, STREET_Y + (y - STREET_Y) * (.28 + .22 * fbm(n * .45, 8))])));
  // 淡金椭圆：以杆脚为心喷在雪面上（颜色层，低饱和；杆身不吃）
  const [gx, gy] = SP(px, pz - .03), grx = .4 * scale(px, STREET_Y, pz), notPole = new Path2D(); notPole.rect(0, 0, W, H); notPole.addPath(pole);
  g.save(); g.clip(notPole, 'evenodd'); g.translate(gx, gy - 8); g.scale(1, .3);
  const gg = g.createRadialGradient(0, 0, 0, 0, 0, grx);
  for (const [t, a] of [[0, .2], [.45, .1], [1, 0]]) gg.addColorStop(t, rgba(SNOW.lampSnow, a));
  g.fillStyle = gg; g.beginPath(); g.arc(0, 0, grx, 0, TAU); g.fill(); g.restore();
}

// —— 墙面 / 台面 / 台边 的光照强度（之后过各自色带）——
function wallWarm(x, y, soft = 0) {
  const dx = x - BULB[0], dy = y - BULB[1], dz = WIN.z - BULB[2], d = Math.hypot(dx, dy, dz);
  const cone = sstep(.30 - soft * .2, .52 + soft * .12, -dy / d) * (1 - soft * .25);                       // 灯罩口以上被罩子挡住：一条斜下来的明暗界
  const spill = 1 / (1 + ((d - dz) / .8) ** 2);
  const bounce = .12 + .22 * Math.exp(-(y - TABLE.y) / .35);    // 台面反上来的暖光
  return bounce + cone * spill * .58 + (fbm(x * 2.2, y * 2.2) - .5) * .09;   // 第 3 轮评委：墙上那道光柱减弱（.98 → .58）
}
// 暖灯 A 的窗墙（r5 导演）：近灯处（灯的左侧、窗下那一条）顶到 #CBB08A（色带 .95），往右边远角衰减到 #5A4458（.25）。
// 灯左侧的横距按 0.6 倍算衰减（左墙整片读成近灯）；窗下那条再吃台面光圈反上来的光；罩口以上仍是罩子挡出的斜明暗界。S5 仍用 wallWarm
function wallA(x, y) {
  const dx = x - BULB[0], dy = y - BULB[1], dz = WIN.z - BULB[2];
  const cone = sstep(.30, .52, -dy / Math.hypot(dx, dy, dz));
  const lamp = cone * Math.exp(-(((Math.hypot(dx < 0 ? dx * .6 : dx, dy, dz) - dz) / .95) ** 2));
  const halo = Math.exp(-(((x - HALO.c[0]) / .8) ** 2) - (y - TABLE.y) / .3);
  return .2 + .05 * Math.exp(-(y - TABLE.y) / .5) + .74 * Math.min(1, 1.2 * lamp + .5 * halo) + (fbm(x * 2.2, y * 2.2) - .5) * .07;
}
// 灯灭：窗墙背光。§4.3 窗边 #4A4E78 → 远角 #22223E：整片宽宽地亮，不在框外收成一圈光环；窗台下面再多一点台上光斑反上来的冷光
function wallDark(x, y) {
  const ox = Math.max(0, Math.abs(x) - WIN.x1), oy = Math.max(0, y - WIN.y1, WIN.y0 - y), dist = Math.hypot(ox * 1.2, oy);
  const bounce = .2 * Math.exp(-(y - TABLE.y) / .22) / (1 + (x / 1.1) ** 2);
  return .3 + .85 * Math.exp(-dist / 1.0) + bounce + (fbm(x * 2.2, y * 2.2) - .5) * .06;   // 贴着窗框外沿顶到 #4A4E78
}
// 暖灯台面 → [光圈外强度, 光圈里强度]。§4.1 光圈：圈内 #A86E3C 平涂；圈外 #7A4A2A（r5 导演：改回，不再往暗处压），只在前沿略暗；圈的形状另用硬边遮罩（haloMasks）
function tableWarm(x, z) {
  const n = (fbm(x * 3, z * 3) - .5) * .06;
  return [.55 - Math.max(0, .95 - z) * .15 + n, .95 + n * .6];
}
const tableOut = (x, z) => .84 + .24 * Math.exp(-Math.hypot(x * .45, (WIN.z - z) * .8) / .9) - Math.max(0, .95 - z) * .25 + (fbm(x * 3, z * 3) - .5) * .06;   // §4.3 斑外 #3A3460，只在两头和前沿略暗
// 光斑里两档硬边色带：靠窗一档亮、靠前沿一档暗（不渐变）；分界稍斜 —— 路灯在右，右边亮档伸得更靠前
const spotSplit = x => 1.07 - .1 * x;
const tableIn = (x, z) => (z > spotSplit(x) ? 1.14 : .8) + (fbm(x * 3, z * 3) - .5) * .03;
function faceI(light, x, y) {                 // 台边（z = 0.80 竖面）：上沿圆角吃光
  const edge = sstep(TABLE.y - .018, TABLE.y - .004, y), down = clamp((TABLE.y - y) / .25);
  const lamp = light === 'warm' ? .55 / (1 + ((x - BULB[0]) / .8) ** 2) : .25;
  return (.55 - down * .5) * (.5 + lamp) + edge * (.35 + lamp);
}

// 一次把一张 A 板的底色逐像素画出来：c（颜色）、e（发光）；暖灯另出 lit（满光圈台面）与 mask（光圈遮罩）
function paintA(light) {
  const R = rowsA(), S = SET[light], warm = light === 'warm';
  const [c, g] = canvas(W, H), [ec, e] = canvas(W, H);
  const im = g.createImageData(W, H), d = im.data, em = e.createImageData(W, H), ed = em.data;
  let lc, lg, li, ld;
  if (warm) { [lc, lg] = canvas(W, H); li = lg.createImageData(W, H); ld = li.data; }
  const o = [0, 0, 0], q = [0, 0, 0];
  for (let j = 0; j < H; j++) {
    const r = R[j];
    for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4, sx = i + .5;
      ed[k + 3] = 255;
      if (r.wall) {
        const x = (sx - r.wall.c) / r.wall.k, y = r.wall.v;
        // 窗外街面两种光照相同（§4.3）。地上的路灯光圈是雪的反光，不进发光板：CRT bloom 叠上去会把 R 顶满，金变成柠檬黄
        if (r.street && x > WIN.x0 && x < WIN.x1 && y > WIN.y0 && y < WIN.y1) street((sx - r.street.c) / r.street.k, r.street.v, o);
        else S.wall(warm ? wallA(x, y) : wallDark(x, y), o);
        put(d, k, o, i, j); if (warm) put(ld, k, o, i, j);
      } else if (r.table) {
        const x = (sx - r.table.c) / r.table.k, z = r.table.v;
        if (warm) {
          const [b, h] = tableWarm(x, z); S.table(b, o); S.table(h, q);
          put(d, k, o, i, j); put(ld, k, q, i, j);
        } else { S.table(light === 'in' ? tableIn(x, z) : tableOut(x, z), o); put(d, k, o, i, j); }
      } else {
        const x = (sx - r.face.c) / r.face.k; S.face(faceI(light, x, r.face.v), o);
        put(d, k, o, i, j); if (warm) put(ld, k, o, i, j);
      }
    }
  }
  g.putImageData(im, 0, 0); e.putImageData(em, 0, 0);
  if (warm) lg.putImageData(li, 0, 0);
  return { c, g, e: ec, eg: e, lit: lc, litg: lg };
}
// §4.1 暖灯光圈的硬边遮罩（r5 导演）：台面上以 HALO.c 为心、半径 HALO.r 的世界圆，逐点过 w2s（屏幕中心 (668, 822)）；
// 后沿越过墙脚、前沿越出台沿的部分都裁在台面行里（后沿贴到墙脚）。外圈一档（宽 3.5 cm）+ 圈内，两张遮罩
function haloMasks() {
  const [cx, , cz] = HALO.c, ring = .035, yBack = yOf(TABLE.y, WIN.z), yFront = yOf(TABLE.y, TABLE.z0);
  return [HALO.r, HALO.r - ring].map(r => {
    const [c, g] = canvas(W, H); g.beginPath(); g.rect(0, yBack, W, yFront - yBack); g.clip();
    g.fillStyle = '#fff'; g.fill(shape((x, z) => w2s(x, TABLE.y, z), ellPts(cx, cz, r, r, 160))); return c;
  });
}
// 光圈合到台面：外圈一档 = 底板和光圈色各半（一道硬边过渡），圈内 = 光圈色；dx 是光圈随灯摆的横移
function haloOnto(g, h, dx, tmp) {
  const [tc, t] = tmp;
  for (const [m, a] of [[h.mask, .5], [h.maskIn, 1]]) {
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.drawImage(m, dx, 0);
    t.globalCompositeOperation = 'source-in'; t.drawImage(h.lit, 0, 0); t.globalCompositeOperation = 'source-over';
    g.globalAlpha = a; g.drawImage(tc, 0, 0); g.globalAlpha = 1;
  }
}

// —— 台面木纹（世界坐标画，过 w2s）：板缝沿 x，纹理绕着木节走；中间揉面处磨亮，几道刀痕 ——
function grain(g, light, seed = 7) {
  const S = SET[light], R = rng(seed), P = (x, z) => w2s(x, TABLE.y, z), K = light === 'in' ? 1.8 : 1;   // 光斑里木纹更清楚
  const ga = (c, a) => rgba(c, Math.min(1, a * K));
  const yBack = yOf(TABLE.y, WIN.z), yFront = yOf(TABLE.y, TABLE.z0);
  g.save(); g.beginPath(); g.rect(0, yBack, W, yFront - yBack); g.clip();
  const [wx, wy] = P(-.2, 1.04);                                 // 揉面处磨亮的一块
  const wr = g.createRadialGradient(wx, wy, 0, wx, wy, 420); wr.addColorStop(0, rgba(S.hi, light === 'in' ? 0 : .16)); wr.addColorStop(1, rgba(S.hi, 0));   // 光斑里不要喷枪亮块（两档硬边）
  g.save(); g.translate(wx, wy); g.scale(1, .32); g.translate(-wx, -wy); g.fillStyle = wr; g.fillRect(wx - 420, wy - 420, 840, 840); g.restore();
  const seams = [TABLE.z0, .975, 1.155, 1.335, WIN.z], knots = [[-.62, 1.07], [.72, 1.27], [1.12, .9], [-1.15, 1.4], [.05, .87], [-.05, 1.2]];
  // r5 导演：光斑里的木节缩小、降对比；碗脚边那颗（OBJ.bowlA2 附近，屏幕约 (930, 745)）再小一档、再淡一档。KS 尺寸系数，KA 浓度系数
  const nb = ([kx, kz]) => Math.hypot(kx - OBJ.bowlA2.c[0], kz - OBJ.bowlA2.c[2]) < .2;
  const KS = knots.map(k => light === 'in' ? (nb(k) ? .38 : .6) : 1), KA = knots.map(k => light === 'in' ? (nb(k) ? .22 : .42) : 1);
  for (let p = 0; p < 4; p++) {
    const z0 = seams[p], z1 = seams[p + 1];
    for (let l = 1; l < 10; l++) {
      const zb = z0 + (z1 - z0) * l / 10, a1 = .003 + R() * .006, f1 = 1.2 + R() * 2.5, ph = R() * TAU;
      g.beginPath();
      for (let n = 0; n <= 140; n++) {
        const x = -1.75 + n * .025; let z = zb + a1 * Math.sin(x * f1 + ph) + .002 * Math.sin(x * 9 + ph * 2);
        knots.forEach(([kx, kz], q) => { const dz = z - kz, u = (x - kx) / .11; if (Math.abs(dz) < .045) z += Math.sign(dz || 1) * .028 * KS[q] * Math.exp(-u * u) * (1 - Math.abs(dz) / .045); });
        const [sx, sy] = P(x, clamp(z, z0 + .004, z1 - .004)); n ? g.lineTo(sx, sy) : g.moveTo(sx, sy);
      }
      g.strokeStyle = ga(S.grain, .14 + R() * .26); g.lineWidth = .8 + R() * .9; g.stroke();
    }
    if (p) {                                                     // 板缝：一道暗缝 + 前一块板的亮边
      const a = P(-1.75, z0), b = P(1.75, z0);
      g.strokeStyle = ga(S.grain, .75); g.lineWidth = 2.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = ga(S.hi, .28); g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1] + 2.2); g.lineTo(b[0], b[1] + 2.2); g.stroke();
    }
  }
  knots.forEach(([kx, kz], q) => { for (const [r0, al] of [[.022, .16], [.01, .38]]) {
    const rr = r0 * KS[q]; g.fillStyle = ga(S.grain, al * KA[q]); g.beginPath();
    for (let n = 0; n < 16; n++) { const a = n / 16 * TAU, [sx, sy] = P(kx + Math.cos(a) * rr * 3.2, kz + Math.sin(a) * rr); n ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }
    g.fill();
  } });
  g.lineWidth = 1; g.strokeStyle = ga(S.hi, .3);              // 刀痕
  for (let n = 0; n < 34; n++) {
    const x = -.7 + R() * 1.5, z = .86 + R() * .42, a = (R() - .5) * 1.2, L = .03 + R() * .07, A0 = P(x, z), B0 = P(x + Math.cos(a) * L, z + Math.sin(a) * L * .5);
    g.beginPath(); g.moveTo(A0[0], A0[1]); g.lineTo(B0[0], B0[1]); g.stroke();
  }
  const ao = g.createLinearGradient(0, yBack, 0, yBack + 20); ao.addColorStop(0, ga(S.grain, .5)); ao.addColorStop(1, ga(S.grain, 0));
  g.fillStyle = ao; g.fillRect(0, yBack, W, 20);
  g.restore();
  g.strokeStyle = ga(S.hi, .55); g.lineWidth = 2; g.beginPath(); g.moveTo(0, yFront + 1); g.lineTo(W, yFront + 1); g.stroke();   // 台沿圆角的一线亮
}

// —— 窗上反写「手擀面」：系统中文无衬线体，先 fonts.load，再和 serif 比像素，确认不是回退 ——
const LETTERS = [['面', (WIN.x0 + WIN.mullions[0]) / 2], ['擀', 0], ['手', (WIN.x1 + WIN.mullions[1]) / 2]];
const LET = { y1: 1.42, s: .22 };
export let FONT = null;
let GLY = null;
async function cjkFont() {
  const FAMS = ['PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'STHeiti', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Microsoft YaHei'];
  const probe = f => { const [, g] = canvas(72, 72); g.font = f; g.fillStyle = SNOW.near; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('擀', 36, 36); return g.getImageData(0, 0, 72, 72).data; };
  const same = (a, b) => { let n = 0; for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 40) n++; return n < 6; };
  const serif = probe('600 56px serif');
  for (const f of FAMS) {
    const spec = `600 56px "${f}"`;
    await document.fonts.load(spec, '手擀面').catch(() => {});
    const a = probe(`${spec}, serif`), b = probe(`${spec}, monospace`);
    if (same(a, b) && !same(a, serif)) return f;
  }
  console.warn('plates.js: 没找到中文无衬线体，窗上的字退回 sans-serif');
  return null;
}
function glyph(ch, fam, seed) {                                  // 256² 的字形遮罩：左右镜像（从屋里看是反字）+ 褪色剥落
  const N = 256, [c, g] = canvas(N, N), R = rng(seed);
  g.translate(N, 0); g.scale(-1, 1);
  g.font = `600 ${N * .9}px ${fam ? `"${fam}"` : 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = SNOW.near; g.fillText(ch, N / 2, N / 2 + N * .04);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 300; i++) { g.globalAlpha = .3 + R() * .7; g.beginPath(); g.arc(R() * N, R() * N, .8 + R() * R() * 6, 0, TAU); g.fill(); }
  for (let i = 0; i < 2; i++) { g.globalAlpha = .12 + R() * .12; g.fillRect(0, R() * N, N, 2 + R() * 4); }
  return c;
}
function mapRows(g, img, row, step = 2) {                         // 平面字形逐行贴到屏幕：row(v) → [sx0, sx1, sy]
  const h = img.height;
  for (let v = 0; v < h; v += step) {
    const [a0, a1, y0] = row(v / h), y1 = row((v + step) / h)[2];
    g.drawImage(img, 0, v, img.width, step, Math.min(a0, a1), Math.min(y0, y1) - .3, Math.abs(a1 - a0), Math.abs(y1 - y0) + .6);
  }
}
const glassRow = cx => v => { const y = LET.y1 - v * LET.s; return [w2s(cx - LET.s / 2, y, WIN.z)[0], w2s(cx + LET.s / 2, y, WIN.z)[0], yOf(y, WIN.z)]; };
// 路灯穿过窗面 (xw, yw) 落到台面：与 layout.spot() 同一几何
const [LX, LY, LZ] = LAMP_STREET, LD = LZ - WIN.z;
const zAt = yw => LZ - (LY - TABLE.y) * LD / (LY - yw), xAt = (xw, z) => LX + (xw - LX) * (LZ - z) / LD;
const onTable = (xw, yw) => { const z = zAt(yw); return w2s(xAt(xw, z), TABLE.y, z); };
const shadowRow = cx => v => { const yw = LET.y1 - v * LET.s, z = zAt(yw); return [w2s(xAt(cx - LET.s / 2, z), TABLE.y, z)[0], w2s(xAt(cx + LET.s / 2, z), TABLE.y, z)[0], yOf(TABLE.y, z)]; };
function tint(mask, col, a = 1) { const [c, g] = canvas(mask.width, mask.height); g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return c; }

// —— 窗：窗外路灯杆、路灯光晕、卷帘门底杠、窗台外的积雪、玻璃雾、暖灯反光、反写字；窗框与窗棂 ——
// 窗外（街景、底杠、雪埂、雾、斜反光）两种光照完全相同（§4.3）；暖灯只多一块硬边反光形：台面暖灯光圈在玻璃里的倒影，15% #F2B25C
function windowA(g, e, light, glyphs) {
  const warm = light === 'warm', Z = WIN.z, P = (x, y, z = Z) => w2s(x, y, z);
  const hole = wpath(w2s, [[WIN.x0, WIN.y1, Z], [WIN.x1, WIN.y1, Z], [WIN.x1, WIN.y0, Z], [WIN.x0, WIN.y0, Z]]);
  g.save(); g.clip(hole); e.save(); e.clip(hole);
  streetDetails(g, e);
  // 灯头（在窗上沿之外）照亮的一团落雪空气：只在窗右上沿喷一层冷雪光，金只留很小的芯；发光板也收小 —— 不再像半轮落日
  const [hx, hy] = P(.72, WIN.y1 + .02), R0 = 330;                 // §4.1：窗右上 x 1180–1580，y 55–200
  for (const [ctx, st] of [[g, [[0, BG.night.snowGrey, .3], [.12, BG.night.snowGrey, .22], [.5, BG.night.snowGrey, .08], [1, BG.night.snowGrey, 0]]],
                           [e, [[0, BG.night.lampGold, .16], [.14, BG.night.lampGold, .05], [.32, BG.night.lampGold, 0]]]]) {
    const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, R0); for (const [t, c, a] of st) gr.addColorStop(t, rgba(c, a));
    ctx.save(); ctx.translate(hx, hy); ctx.scale(1, .5); ctx.translate(-hx, -hy); ctx.fillStyle = gr; ctx.fillRect(hx - R0, hy - R0, 2 * R0, 2 * R0); ctx.restore();
  }
  // 窗台外的积雪：玻璃下沿一道起伏的雪埂
  const ridge = new Path2D();
  for (let n = 0; n <= 80; n++) { const x = WIN.x0 + n / 80 * (WIN.x1 - WIN.x0), [sx, sy] = P(x, WIN.y0 + .016 + .022 * fbm(x * 6, 3) + .007 * Math.sin(x * 19), Z + .06); n ? ridge.lineTo(sx, sy) : ridge.moveTo(sx, sy); }
  { const [a, b] = [P(WIN.x1, WIN.y0 - .05), P(WIN.x0, WIN.y0 - .05)]; ridge.lineTo(a[0], a[1]); ridge.lineTo(b[0], b[1]); ridge.closePath(); }
  const [r0] = P(WIN.x0, WIN.y0), [r1] = P(WIN.x1, WIN.y0), rg = g.createLinearGradient(r0, 0, r1, 0);
  rg.addColorStop(0, mix(SNOW.far, SNOW.mid, .1)); rg.addColorStop(1, mix(SNOW.far, SNOW.mid, .4));   // 窗台外的雪顶面被路灯照着，比街上的雪亮一档
  g.fillStyle = rg; g.fill(ridge);
  const sill = yOf(WIN.y0, Z);
  g.save(); g.clip(ridge);
  { const sh = g.createLinearGradient(0, sill - 30, 0, sill); sh.addColorStop(0, rgba(BG.night.indigo, 0)); sh.addColorStop(1, rgba(BG.night.indigo, .35)); g.fillStyle = sh; g.fillRect(0, sill - 30, W, 30); }
  g.strokeStyle = SNOW.mid; g.lineWidth = 4; g.stroke(ridge); g.restore();
  e.fillStyle = rgba(SNOW.lampSnow, .05); e.fill(ridge);
  // 卷帘门卷在窗上沿（A / A'，y 55–69 共 14 px）：深色钢卷筒，三道横向硬边高光从上往下一档比一档弱（卷筒的圆），
  // 最下是底杠的唇和落在玻璃上的一线暗影。
  // 窗外的东西两种光照相同（§4.3）：暖灯 A 也用同一套冷钢色，不再出橙线
  const yAt = dy => inv(u => yOf(u, Z), yOf(WIN.y1, Z) + dy, WIN.y0, WIN.y1), barY = yAt(14);
  const band = (d0, d1, col) => { g.fillStyle = col; g.fill(wpath(w2s, [[WIN.x0 - .1, yAt(d0), Z], [WIN.x1 + .1, yAt(d0), Z], [WIN.x1 + .1, yAt(d1), Z], [WIN.x0 - .1, yAt(d1), Z]])); };
  const BODY = mix(BG.dark.grain, BG.night.indigo, .25);
  const bar = wpath(w2s, [[WIN.x0, WIN.y1 + .05, Z], [WIN.x1, WIN.y1 + .05, Z], [WIN.x1, barY, Z], [WIN.x0, barY, Z]]);
  g.fillStyle = BODY; g.fill(bar); e.fillStyle = '#000'; e.fill(bar);
  band(1.0, 3.0, mix(SNOW.mid, BODY, .2));                       // 高光 1：卷筒顶上迎路灯的一条，最亮
  band(3.0, 4.0, BG.dark.grain);                                  // 暗槽
  band(7.0, 8.6, mix(BG.night.snowGrey, BODY, .3));               // 高光 2：卷筒往下转，弱一档
  band(11.0, 12.4, mix(BG.night.snowGrey, BODY, .58));            // 高光 3：底杠上倒角，最弱
  band(12.4, 14, BG.dark.grain);                                  // 底杠下唇 + 玻璃上一线暗影
  glassA(g, e, light, glyphs);
  g.restore(); e.restore();
  frameA(g, e, warm);
}
// 玻璃上的东西（压在窗外一切之上，调用方已裁好窗洞）：薄雾、暖灯 15% 暖反光、斜冷反光、反写字。
// 卷帘门落下时 drawShutter() 把灯灭这一层再印在门板上面（字是漆在玻璃里侧的，门在玻璃外）
function glassA(g, e, light, glyphs) {
  const warm = light === 'warm', Z = WIN.z, P = (x, y, z = Z) => w2s(x, y, z), sill = yOf(WIN.y0, Z);
  const yt = inv(u => yOf(u, Z), yOf(WIN.y1, Z) + 14, WIN.y0, WIN.y1);   // 卷筒下沿（窗上沿往下 14 px）的世界高度
  // 玻璃下沿一层薄雾（S8 外景「蒙着热气的高窗」）：冷色，压得很低，不盖住雪
  const fog = g.createLinearGradient(0, sill, 0, sill - 80);
  fog.addColorStop(0, rgba(SNOW.far, .2)); fog.addColorStop(.5, rgba(SNOW.far, .06)); fog.addColorStop(1, rgba(SNOW.far, 0));
  g.fillStyle = fog; g.fillRect(0, sill - 80, W, 80);
  // §4.3：暖灯时整块玻璃叠 15% 暖色反光 #F2B25C（靛蓝 #1E2450 → 约 #3E3952）；灯灭不叠
  if (warm) { g.fillStyle = rgba(BG.warm.glassTint, .15); g.fillRect(0, 0, W, H); }
  // 玻璃上斜着几道硬边冷反光（画在背景上的老做法，两种光照相同）
  for (const [x0, w, a] of [[-.74, .07, .056], [-.6, .025, .044], [-.18, .09, .036], [.36, .05, .04], [.47, .02, .036]]) {
    const k = .32; g.fillStyle = rgba(SNOW.mid, a);
    g.fill(wpath(w2s, [[x0 + k * .75, yt, Z], [x0 + w + k * .75, yt, Z], [x0 + w, WIN.y0, Z], [x0, WIN.y0, Z]]));
  }
  // 暖灯：台面光圈在玻璃里的倒影（光圈按窗面 z = 1.50 镜像，过 w2s），一块硬边形，在整块 15% 之上再淡淡加一层
  if (warm) {
    const refl = new Path2D(), zMir = z => 2 * Z - z;
    for (let n = 0; n <= 48; n++) {
      const a = n / 48 * TAU, z = Math.max(TABLE.z0, HALO.c[2] + Math.sin(a) * HALO.r), x = HALO.c[0] + Math.cos(a) * HALO.r;
      const [sx, sy] = P(x, TABLE.y, zMir(z)); n ? refl.lineTo(sx, sy) : refl.moveTo(sx, sy);
    }
    refl.closePath(); g.fillStyle = rgba(BG.warm.glassTint, .07); g.fill(refl);
  }
  // 反写「手擀面」：暖灯下是被灯照着的旧白漆；灯灭后是漆的背面，衬着雪光成了暗字
  // r5 导演：暖灯下的字原来 #D0CDCD 太亮太灰、抢了灯 → 暖色旧漆约 #C9B89C（墙近灯色往雪中间色走 2–3 成），55–65% 强度，笔画边缘按 peel 啃出剥落；A' 暗字不动
  const src = warm ? glyphs.map((gl, i) => peel(gl, 61 + i * 5)) : glyphs, la = warm ? .6 : .9;
  const [mc, m] = canvas(W, H); LETTERS.forEach(([, cx], i) => mapRows(m, src[i], glassRow(cx)));
  const [x0] = P(WIN.x0, 1.3), [x1] = P(WIN.x1, 1.3), lg = g.createLinearGradient(x0, 0, x1, 0);
  if (warm) { lg.addColorStop(0, mix(BG.warm.wallNear, SNOW.mid, .18)); lg.addColorStop(1, mix(BG.warm.wallNear, SNOW.mid, .28)); }   // 靠灯一侧略暖，离灯远一点略冷
  else { lg.addColorStop(0, mix(BG.dark.wallFar, BG.dark.wallNear, .25)); lg.addColorStop(1, mix(BG.dark.wallFar, BG.dark.wallNear, .45)); }
  g.drawImage(tint(mc, lg, la), 0, 0); e.drawImage(tint(mc, '#000', warm ? la : 1), 0, 0);
}

// 窗框（贴墙的一圈旧木框）+ 两根窗棂（正面 + 朝屏幕中间的侧面）
// 灯灭：逆光，整圈暗部 #1E1A3A；路灯在窗外右上，只照到每格玻璃的左沿和下沿 → 只在这两条内沿上 2 px 雪青灰轮廓光
function frameA(g, e, warm) {
  const Z = WIN.z, P = (x, y, z = Z) => w2s(x, y, z), cw = .06, hw = WIN.mullionW / 2, m = WIN.mullions;
  const hole = wpath(w2s, [[WIN.x0, WIN.y1, Z], [WIN.x1, WIN.y1, Z], [WIN.x1, WIN.y0, Z], [WIN.x0, WIN.y0, Z]]);
  // 上沿直接出画（r5：原来离画框只剩 5 px，和画框成切线）：外框上边抬到 y1 + 2.5 cw，屏幕在画框以上
  const outer = wpath(w2s, [[WIN.x0 - cw, WIN.y1 + cw * 2.5, Z], [WIN.x1 + cw, WIN.y1 + cw * 2.5, Z], [WIN.x1 + cw, WIN.y0 - cw * .8, Z], [WIN.x0 - cw, WIN.y0 - cw * .8, Z]]);
  const fr = new Path2D(); fr.addPath(outer); fr.addPath(hole);
  const sideX = mx => mx < 0 ? mx + hw : mx - hw;
  const sides = m.map(mx => wpath(w2s, [[sideX(mx), WIN.y1, Z], [sideX(mx), WIN.y1, Z + .05], [sideX(mx), WIN.y0, Z + .05], [sideX(mx), WIN.y0, Z]]));
  const fronts = m.map(mx => wpath(w2s, [[mx - hw, WIN.y1, Z], [mx + hw, WIN.y1, Z], [mx + hw, WIN.y0, Z], [mx - hw, WIN.y0, Z]]));
  const [f0] = P(WIN.x0 - cw, 1.5), [f1] = P(WIN.x1 + cw, 1.5), fg = g.createLinearGradient(f0, 0, f1, 0);
  // 灯灭：框和棂都是逆光的平涂暗部，取 BG.dark.grain 一族的深靛 —— 一定比后面的玻璃暗；正面略提一点，侧面压到底
  const DK = mix(BG.dark.grain, BG.dark.woodDark, .3);
  // 暖灯：受光的左半正面提暖（r5，跟墙一起）：#A86E3C 往墙近灯色走 3 成 → 中段 #7A4A2A / #A86E3C 之间 → 右端背光暗
  const FC = warm ? [mix(BG.warm.woodHalo, BG.warm.wallNear, .3), mix(BG.warm.wood, BG.warm.woodHalo, .45), mix(BG.warm.grain, BG.warm.woodDark, .4)] : [DK, DK, DK];
  fg.addColorStop(0, FC[0]); fg.addColorStop(.4, FC[1]); fg.addColorStop(1, FC[2]);
  g.save(); g.shadowColor = rgba(warm ? BG.warm.woodDark : BG.dark.grain, .55); g.shadowBlur = 10; g.shadowOffsetX = 4; g.shadowOffsetY = 5;
  g.fillStyle = fg; g.fill(fr, 'evenodd'); g.restore();
  e.fillStyle = '#000'; e.fill(fr, 'evenodd');
  // 暖灯：右棂露出的侧面朝左、迎着吊灯 → 受光（木色）；左棂侧面背灯 → 暗
  for (let i = 0; i < 2; i++) { g.fillStyle = warm ? (i ? mix(BG.warm.wood, BG.warm.woodHalo, .25) : FC[2]) : BG.dark.grain; g.fill(sides[i]); g.fillStyle = FC[1]; g.fill(fronts[i]); e.fill(sides[i]); e.fill(fronts[i]); }
  const edge = (a, b) => { const A = P(...a), B = P(...b); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); };
  if (warm) {                                                     // 暖灯：吊灯从屋里照，框正面受光，下沿和右沿一线暖
    g.strokeStyle = rgba(LIGHT.warm, .68); g.lineWidth = 2;
    edge([WIN.x0, WIN.y0], [WIN.x1, WIN.y0]); edge([WIN.x1, WIN.y0], [WIN.x1, WIN.y1]);
    g.strokeStyle = rgba(BG.warm.wallNear, .6); edge([WIN.x0 - cw, WIN.y1 + cw * 2.5], [WIN.x0 - cw, WIN.y0 - cw * .8]);
    for (const mx of m) { g.strokeStyle = rgba(LIGHT.warm, .62); g.lineWidth = 1.6; edge([mx - hw, WIN.y0], [mx - hw, WIN.y1]); }
    return;
  }
  // 灯灭：每格玻璃的左沿 + 窗台内沿，4 px 线只留落在木框一侧的 2 px
  g.save(); g.clip(fr, 'evenodd');
  g.strokeStyle = BG.night.snowGrey; g.lineWidth = 4; g.lineCap = 'butt';
  edge([WIN.x0, WIN.y0], [WIN.x0, WIN.y1]); edge([WIN.x0, WIN.y0], [WIN.x1, WIN.y0]);
  g.restore();
  for (let i = 0; i < 2; i++) {                                   // 窗棂：左棂的可见侧面朝右（迎着路灯）→ 侧面外沿；右棂正面的右沿
    const mx = m[i], [a, b] = i === 0 ? [[mx + hw, WIN.y0, Z + .05], [mx + hw, WIN.y1, Z + .05]] : [[mx + hw, WIN.y0, Z], [mx + hw, WIN.y1, Z]];
    g.save(); g.clip(i === 0 ? sides[0] : fronts[1]); g.strokeStyle = BG.night.snowGrey; g.lineWidth = 4; g.lineCap = 'butt'; edge(a, b); g.restore();
  }
}

// —— 墙上的旧痕：窗台下的水渍、窗右边一道细裂缝 ——
function wallMarks(g, light) {
  const warm = light === 'warm', dk = warm ? BG.warm.wallFar : BG.dark.grain, lt = warm ? BG.warm.wallNear : BG.dark.wallNear, Z = WIN.z;
  for (const [x, a] of [[-.52, .16], [.08, .12], [.62, .14]]) {
    const [sx, sy] = w2s(x, WIN.y0 - .02, Z), [, ey] = w2s(x, TABLE.y + .04, Z), gr = g.createLinearGradient(0, sy, 0, ey);
    gr.addColorStop(0, rgba(dk, a)); gr.addColorStop(1, rgba(dk, 0)); g.fillStyle = gr;
    g.beginPath(); g.ellipse(sx, (sy + ey) / 2, 5 + 7 * hash(x * 9), (ey - sy) / 2, 0, 0, TAU); g.fill();
  }
  // 窗右上一块掉了面层的墙皮（喷枪：露出的灰底 + 上沿一层软影 + 下沿翘起的一线亮边），从它下角裂出一道由粗到细的裂缝。
  // 第 3 轮评委：原来那条等粗折线像渲染残留 → 改成这样
  const WP = (x, y) => w2s(x, y, Z), R = rng(53), flake = [], dk2 = warm ? mix(BG.warm.wallFar, BG.warm.grain, .55) : BG.dark.grain;
  for (let n = 0; n < 28; n++) { const a = n / 28 * TAU, r = 1 + .18 * (R() - .5) + .1 * Math.sin(a * 3 + 1); flake.push([1.03 + Math.cos(a) * .1 * r, 1.6 + Math.sin(a) * .055 * r]); }
  const fl = shape(WP, flake), [fx, fy] = WP(1.03, 1.6);
  g.fillStyle = rgba(dk2, warm ? .18 : .13); g.fill(fl);                                    // 露出来的灰底（淡，别成一个黑洞）
  g.save(); g.clip(fl);
  const fs = g.createLinearGradient(fx, fy - 34, fx, fy + 8); fs.addColorStop(0, rgba(dk2, warm ? .38 : .28)); fs.addColorStop(1, rgba(dk2, 0));
  g.fillStyle = fs; g.fillRect(fx - 90, fy - 40, 180, 50); g.restore();                    // 面层的厚度在上沿投下一层软影
  g.save(); g.translate(1, 1.5); g.strokeStyle = rgba(lt, warm ? .5 : .4); g.lineWidth = 1.4;   // 下沿（朝灯的一边）翘起的面层吃光，比缺口往右下错 1–2 px
  g.beginPath(); flake.slice(15, 27).forEach((q, i) => { const [x, y] = WP(...q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.restore();
  const crack = [[1.115, 1.565], [1.15, 1.54], [1.18, 1.505], [1.24, 1.475], [1.27, 1.43], [1.33, 1.395], [1.36, 1.35]], twig = [[1.18, 1.505], [1.22, 1.515], [1.28, 1.525]];
  for (const [pts, w0, w1] of [[crack, 2.6, .5], [twig, 1.3, .4]]) for (let i = 1; i < pts.length; i++) {   // 一段一段描，越往外越细
    const [a, b] = [WP(...pts[i - 1]), WP(...pts[i])], w = w0 + (w1 - w0) * (i - 1) / (pts.length - 2 || 1);
    g.lineCap = 'round'; g.strokeStyle = rgba(lt, .16); g.lineWidth = Math.max(.6, w * .5); g.beginPath(); g.moveTo(a[0] + .9, a[1] + 1.3); g.lineTo(b[0] + .9, b[1] + 1.3); g.stroke();
    g.strokeStyle = rgba(dk2, .85); g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  const yBack = yOf(TABLE.y, Z), ao = g.createLinearGradient(0, yBack - 28, 0, yBack);
  ao.addColorStop(0, rgba(warm ? BG.warm.woodDark : BG.dark.grain, 0)); ao.addColorStop(1, rgba(warm ? BG.warm.woodDark : BG.dark.grain, .4));
  g.fillStyle = ao; g.fillRect(0, yBack - 28, W, 28);
}

// 褪色漆的残缺：笔画边缘（模糊后 alpha 在 0.15–0.85 之间）按低频噪声啃掉一块块，留下的全是硬边；笔画中间只零星掉漆
function peel(src, seed) {
  const N = src.width, [c, g] = canvas(N, N); g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, N, N), d = im.data, a = new Float32Array(N * N), b = new Float32Array(N * N), r = 6;
  for (let k = 0; k < N * N; k++) a[k] = d[k * 4 + 3] / 255;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = 0; for (let u = -r; u <= r; u++) s += a[j * N + clamp(i + u, 0, N - 1)]; b[j * N + i] = s / (2 * r + 1); }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let s = 0; for (let u = -r; u <= r; u++) s += b[clamp(j + u, 0, N - 1) * N + i]; a[j * N + i] = s / (2 * r + 1); }
  for (let k = 0; k < N * N; k++) {
    if (!d[k * 4 + 3]) continue;
    const i = k % N, j = (k / N) | 0, edge = 1 - Math.abs(2 * a[k] - 1), n = fbm(i * .06 + seed, j * .06 - seed * .5);
    d[k * 4 + 3] = n < .12 + .56 * edge ? 0 : 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// —— 灯灭光斑内板：窗棂影 + 字影（路灯把窗上的字投到台面上，上下颠倒）都用光斑外那张板挖出来 ——
function spotShadows(gIn, cOut, glyphs) {
  const [mc, m] = canvas(W, H), hw = WIN.mullionW / 2;
  m.fillStyle = SNOW.near;
  for (const mx of WIN.mullions) { m.beginPath(); [[mx - hw, WIN.y0], [mx + hw, WIN.y0], [mx + hw, WIN.y1], [mx - hw, WIN.y1]].forEach(([x, y], i) => { const [sx, sy] = onTable(x, y); i ? m.lineTo(sx, sy) : m.moveTo(sx, sy); }); m.fill(); }
  // 字影：褪色白漆只挡掉一部分光 → 27% 浅影（窗棂影是满的），笔画边上被褪色漆啃出硬边缺口。
  // r5 导演：三个字影都投、走同一个投影（shadowRow）；碗（OBJ.bowlA2，挪到中间那格）压住「擀」影的后半，碗由合成画在板子上面，
  // 字影照常铺在碗下 → 从碗前、碗左露出一角，不再整字不投
  const [lc, l] = canvas(W, H); LETTERS.forEach(([, cx], i) => mapRows(l, peel(glyphs[i], 31 + i * 7), shadowRow(cx)));
  m.globalAlpha = .27; m.drawImage(lc, 0, 0); m.globalAlpha = 1;
  const [tc, t] = canvas(W, H); t.drawImage(cOut, 0, 0); t.globalCompositeOperation = 'destination-in'; t.drawImage(mc, 0, 0);
  gIn.drawImage(tc, 0, 0);
}

// —— S13 卷帘门（38.625–39.75 落下）：门板加载时预画成一块，按底杠高 h 整体下移（§9），底杠和光斑用同一个 h ——
// §11 #2 色值（雪夜；从屋里看到的是门板里侧，背光，几乎全暗）：
//   板条 slat #171838，板条下半硬边暗面 shade #151430，接缝 seam #121028，接缝下一线雪光 lip #434769，
//   底杠 bar #1A1E44、底杠下唇雪光 barLip #60678E；冲孔光点 = 路灯金 #FFD27A（颜色层 α .3–.85，发光板 α .2–.6，半径 1.1 px，离路灯越近越亮）
// 板条间距 34 px、冲孔横距 17 px / 行距 16–18 px（都 ≥ 14 px，且不是扫描线 3 px 的整数倍）
const DSLAT = mix(BG.dark.grain, BG.night.indigo, .4);
const DOOR = { pitch: 34, holeDx: 17, holeRows: [9, 25], holeR: 1.1, bar: 22, pad: 520,
  slat: DSLAT, shade: mix(DSLAT, BG.dark.grain, .5), seam: BG.dark.grain, lip: mix(BG.night.snowGrey, DSLAT, .62),
  barC: mix(BG.night.indigo, BG.dark.grain, .3), barLip: mix(BG.night.snowGrey, BG.night.indigo, .4) };
// 窗洞三格玻璃（扣掉窗棂）在两个世界高度之间的部分
function panes(yTop, yBot) {
  const m = WIN.mullions, hw = WIN.mullionW / 2, out = new Path2D(), WZ = (x, y) => w2s(x, y, WIN.z);
  for (const [a, b] of [[WIN.x0, m[0] - hw], [m[0] + hw, m[1] - hw], [m[1] + hw, WIN.x1]]) out.addPath(shape(WZ, [[a, yTop], [b, yTop], [b, yBot], [a, yBot]]));
  return out;
}
function shutterPlate(glyphs) {
  const yb = yOf(WIN.y0, WIN.z), top = yOf(WIN.y1, WIN.z), HT = H + DOOR.pad, P0 = DOOR.pad;   // 关到底时底杠下沿落在窗台 yb；画布往上多留 pad
  const [c, g] = canvas(W, HT), [ec, e] = canvas(W, HT);
  const x0 = w2s(WIN.x0 - .12, WIN.y1, WIN.z)[0], x1 = w2s(WIN.x1 + .12, WIN.y1, WIN.z)[0], yTop = top - (yb - top) - 40;
  g.translate(0, P0); e.translate(0, P0);
  g.fillStyle = DOOR.slat; g.fillRect(x0, yTop, x1 - x0, yb - yTop); e.fillStyle = '#000'; e.fillRect(x0, yTop, x1 - x0, yb - yTop);
  for (let yS = yb - DOOR.bar; yS > yTop; yS -= DOOR.pitch) {             // 一条板条：[yS − pitch, yS]
    const y = yS - DOOR.pitch;
    g.fillStyle = DOOR.shade; g.fillRect(x0, yS - 12, x1 - x0, 12);       // 板条往外凸，下半一块硬边暗面
    g.fillStyle = DOOR.seam; g.fillRect(x0, y, x1 - x0, 2.5);
    g.fillStyle = DOOR.lip; g.fillRect(x0, y + 2.5, x1 - x0, 1.5);
    DOOR.holeRows.forEach((ry, ri) => {
      for (let x = x0 + 6 + (ri ? DOOR.holeDx / 2 : 0); x < x1; x += DOOR.holeDx) {
        const w = clamp(.15 + .85 * (x - 420) / 1150) * (.8 + .2 * hash(x * .37 + y * 1.91)), r = DOOR.holeR;
        g.fillStyle = rgba(BG.night.lampGold, .3 + .55 * w); g.beginPath(); g.arc(x, y + ry, r, 0, TAU); g.fill();
        e.fillStyle = rgba(BG.night.lampGold, .2 + .4 * w); e.beginPath(); e.arc(x, y + ry, r + .3, 0, TAU); e.fill();
      }
    });
  }
  g.fillStyle = DOOR.barC; g.fillRect(x0, yb - DOOR.bar, x1 - x0, DOOR.bar);   // 底杠：上沿一道暗缝，下唇一线雪光（窗台上的雪反上来的）
  g.fillStyle = DOOR.seam; g.fillRect(x0, yb - DOOR.bar, x1 - x0, 3);
  g.fillStyle = DOOR.barLip; g.fillRect(x0, yb - 4, x1 - x0, 2.5);
  const [gc, gg] = canvas(W, H), [gec, gge] = canvas(W, H);                // 灯灭的玻璃层（字、斜反光、薄雾），印在门板上面
  glassA(gg, gge, 'out', glyphs);
  return { c, e: ec, glass: { c: gc, e: gec } };
}
// 合成在 frameA2 里、窗里的雪之后调用：drawShutter(g, e, A, shutterH(t), smear)。h ≥ 1.85 时卷着（窗上沿那条卷筒已在背景板里），什么都不画。
// smear：下落时的竖向拖影 px（§9 约 16 px），静止时 0
export function drawShutter(g, e, A, h, smear = 0) {
  if (h >= WIN.y1 - 1e-4) return;
  const S = A.plateA.shutter, hb = Math.max(h, WIN.y0), yt = inv(u => yOf(u, WIN.z), yOf(WIN.y1, WIN.z) + 14, WIN.y0, WIN.y1);
  const dy = yOf(hb, WIN.z) - yOf(WIN.y0, WIN.z) - DOOR.pad, n = smear > 0 ? 8 : 1;
  for (const [ctx, src, glass] of [[g, S.c, S.glass.c], [e, S.e, S.glass.e]]) {
    ctx.save(); ctx.clip(panes(yt, hb));
    for (let k = 0; k < n; k++) { ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(src, 0, dy - smear * k / Math.max(1, n - 1)); }   // 等权叠几张 = 竖向拖影
    ctx.globalAlpha = 1; ctx.drawImage(glass, 0, 0); ctx.restore();
  }
}

// —— 导出 ——
export async function load() {
  FONT = await cjkFont();
  const glyphs = GLY = LETTERS.map(([ch], i) => glyph(ch, FONT, 11 + i));
  const warm = paintA('warm'), out = paintA('out'), inn = paintA('in');
  for (const [p, light] of [[warm, 'warm'], [out, 'out'], [inn, 'in']]) { wallMarks(p.g, light); grain(p.g, light); windowA(p.g, p.eg, light, glyphs); }
  grain(warm.litg, 'warm');
  spotShadows(inn.g, out.c, glyphs);
  const [bc, b] = canvas(W, H); b.drawImage(warm.c, 0, 0);          // 无光圈的底板（光圈随灯摆左右扫时用）
  const [mask, maskIn] = haloMasks(), halo = { base: bc, lit: warm.lit, mask, maskIn };
  TMP = TMP || canvas(W, H); haloOnto(warm.g, halo, 0, TMP);
  const s5 = paintS5();
  return {
    plateA: { warm: { c: warm.c, e: warm.e }, darkIn: { c: inn.c, e: inn.e }, darkOut: { c: out.c, e: out.e }, halo, shutter: shutterPlate(glyphs) },
    plateS5: s5,
  };
}
// 暖灯板，光圈随灯摆横移 dx px（TREATMENT S1：±50 px）；dx = 0 时与 plateA.warm 一模一样
let TMP = null;
export function drawWarmA(g, e, A, dx = 0) {
  const h = A.plateA.halo; TMP = TMP || canvas(W, H);
  g.drawImage(h.base, 0, 0); haloOnto(g, h, dx, TMP); if (e) e.drawImage(A.plateA.warm.e, 0, 0);
}

// —— S5 仰拍：机位在师傅胸前偏左 (−0.40, 0.92, 0.32)，仰 42°（上摇 6° 之后的定格；起幅仰 36° = 整体上移 118 px）——
// 身后是同一面窗墙：上方吊灯（被面片挡住，只露光晕），下方高窗——对面二层小楼、落雪的屋檐、路灯杆、玻璃里映着吊灯
export const S5C = { pos: [-0.40, 0.92, 0.32], pitch: 42 * Math.PI / 180, F: 1125, shift: 118 };
export function s5(x, y, z) {
  const [cx, cy, cz] = S5C.pos, c = Math.cos(S5C.pitch), s = Math.sin(S5C.pitch), dy = y - cy, dz = z - cz;
  const zc = dy * s + dz * c, yc = dy * c - dz * s;
  return [960 + S5C.F * (x - cx) / zc, 540 - S5C.F * yc / zc];
}
const FAC = { z: 10.0, roof: 5.9, w0: 3.1, w1: 4.4, bay: 1.7 };
function outsideS5(xw, yw, o) {                // 窗面上一点 → 视线穿出去：对面楼 / 屋檐积雪 / 夜空；返回 [路灯光晕, 亮窗]
  const [cx, cy, cz] = S5C.pos, k = (FAC.z - cz) / (WIN.z - cz), xf = cx + k * (xw - cx), yf = cy + k * (yw - cy);
  const dr = [xw - cx, yw - cy, WIN.z - cz], dl = [LX - cx, LY - cy, LZ - cz];
  const ang = Math.acos(clamp((dr[0] * dl[0] + dr[1] * dl[1] + dr[2] * dl[2]) / Math.hypot(...dr) / Math.hypot(...dl), -1, 1));
  const glow = Math.exp(-((ang / .2) ** 2)) + .35 * Math.exp(-((ang / .5) ** 2));
  let lit = 0;
  if (yf > FAC.roof + .14) {                                    // 夜空：低处被落雪映灰，高处靛蓝
    const t = clamp((yf - FAC.roof) / 3.5); o[0] = RGB.haze[0] + (RGB.ind[0] - RGB.haze[0]) * t; o[1] = RGB.haze[1] + (RGB.ind[1] - RGB.haze[1]) * t; o[2] = RGB.haze[2] + (RGB.ind[2] - RGB.haze[2]) * t;
  } else if (yf > FAC.roof) { const c = hex(mix(SNOW.far, SNOW.mid, .4)); o[0] = c[0]; o[1] = c[1]; o[2] = c[2]; }   // 屋檐上的雪
  else {
    const col = Math.floor((xf + 40) / FAC.bay), u = ((xf + 40) % FAC.bay) / FAC.bay, lamp = 1 / (1 + ((xf - LX) / 2.6) ** 2 + ((yf - 4.6) / 2.2) ** 2);
    const base = hex(mix(BG.night.indigo, BG.dark.grain, .45)); o[0] = base[0]; o[1] = base[1]; o[2] = base[2];
    if (yf > FAC.roof - .22) mixInto(o, hex(BG.dark.grain), .6);                     // 檐下一道影
    if (u > .2 && u < .83 && yf > FAC.w0 - .12 && yf < FAC.w0) mixInto(o, hex(SNOW.mid), .8);   // 窗台积雪
    else if (u > .25 && u < .78 && yf > FAC.w0 && yf < FAC.w1) {
      if (hash(col * 7.31) > .62) {                                                  // 亮着灯的人家：暖窗 + 半截窗帘
        lit = 1; const c = hex(mix(mix(BG.night.lampGold, BG.warm.glassTint, .4), BG.night.indigo, .3)); o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
        if (yf < FAC.w0 + (FAC.w1 - FAC.w0) * .45 || u < .33) { mixInto(o, hex(BG.warm.wood), .55); lit = .4; }
      } else { mixInto(o, hex(BG.dark.grain), .5); if (Math.abs(u - .5 - (yf - 3.7) * .25) < .04) mixInto(o, hex(SNOW.far), .3); }
    }
    mixInto(o, RGB.gold, lamp * .3);
  }
  mixInto(o, RGB.ind, .42);
  mixInto(o, RGB.lsnow, clamp(glow * .42));
  return [glow, lit];
}
function paintS5() {
  const HT = H + S5C.shift, [c, g] = canvas(W, HT), [ec, e] = canvas(W, HT);
  const im = g.createImageData(W, HT), d = im.data, em = e.createImageData(W, HT), ed = em.data, o = [0, 0, 0];
  const gold = RGB.gold, warmE = hex(BG.warm.glassTint);
  for (let j = 0; j < HT; j++) {
    const r = rowOnZ(s5, WIN.z, j + .5, -.3, 9);
    for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4, x = (i + .5 - r.c) / r.k, y = r.v; ed[k + 3] = 255;
      if (x > WIN.x0 && x < WIN.x1 && y > WIN.y0 && y < WIN.y1) {
        const [gl, lit] = outsideS5(x, y, o), a = clamp(gl * gl * .6);
        ed[k] = gold[0] * a + warmE[0] * lit * .3; ed[k + 1] = gold[1] * a + warmE[1] * lit * .3; ed[k + 2] = gold[2] * a + warmE[2] * lit * .3;
      } else SET.warm.wall(wallWarm(x, y, 1), o);
      put(d, k, o, i, j);
    }
  }
  g.putImageData(im, 0, 0); e.putImageData(em, 0, 0);
  const Z = WIN.z, hole = wpath(s5, [[WIN.x0, WIN.y1, Z], [WIN.x1, WIN.y1, Z], [WIN.x1, WIN.y0, Z], [WIN.x0, WIN.y0, Z]]);
  g.save(); g.clip(hole); e.save(); e.clip(hole);
  for (const [cv, ctx] of [[c, g], [ec, e]]) { const [bc, b] = canvas(W, HT); b.filter = 'blur(7px)'; b.drawImage(cv, 0, 0); ctx.drawImage(bc, 0, 0); }   // 窗外离得远：虚一点
  const pr = .065, pole = wpath(s5, [[LX - pr, 5.6, LZ], [LX + pr, 5.6, LZ], [LX + pr, STREET_Y, LZ], [LX - pr, STREET_Y, LZ]]);   // 路灯杆
  g.fillStyle = mix(BG.dark.grain, BG.night.indigo, .4); g.fill(pole); e.fillStyle = '#000'; e.fill(pole);
  g.fillStyle = rgba(BG.night.lampGold, .5); g.fill(wpath(s5, [[LX - pr, 5.6, LZ], [LX - pr + .02, 5.6, LZ], [LX - pr + .02, STREET_Y, LZ], [LX - pr, STREET_Y, LZ]]));
  g.fillStyle = rgba(BG.warm.glassTint, .15); g.fill(hole);                    // 玻璃上的暖色反光
  const [rx, ry] = s5(SHADE.c[0], SHADE.c[1], 2 * WIN.z - SHADE.c[2]);          // 吊灯在玻璃里的倒影
  for (const [ctx, a] of [[g, .55], [e, .16]]) {
    const gr = ctx.createRadialGradient(rx, ry, 0, rx, ry, 150); gr.addColorStop(0, rgba(CORE, a)); gr.addColorStop(.25, rgba(LIGHT.warm, a * .6)); gr.addColorStop(1, rgba(BG.warm.glassTint, 0));
    ctx.fillStyle = gr; ctx.fillRect(rx - 150, ry - 150, 300, 300);
  }
  const [mc, m] = canvas(W, HT);                                               // 反写「手擀面」：被头顶吊灯照着的旧白漆
  LETTERS.forEach(([, cx], i) => mapRows(m, GLY[i], v => { const y = LET.y1 - v * LET.s; return [s5(cx - LET.s / 2, y, Z)[0], s5(cx + LET.s / 2, y, Z)[0], s5(cx, y, Z)[1]]; }));
  const t1 = tint(m.canvas, mix(SNOW.mid, BG.warm.wallNear, .45), .5), t2 = tint(m.canvas, '#000', 1);
  g.drawImage(t1, 0, 0); e.drawImage(t2, 0, 0);
  g.restore(); e.restore();
  const cw = .06, fr = new Path2D(); fr.addPath(wpath(s5, [[WIN.x0 - cw, WIN.y1 + cw, Z], [WIN.x1 + cw, WIN.y1 + cw, Z], [WIN.x1 + cw, WIN.y0 - cw, Z], [WIN.x0 - cw, WIN.y0 - cw, Z]])); fr.addPath(hole);
  const FC = [mix(BG.warm.wood, BG.warm.wallNear, .3), BG.warm.wood, mix(BG.warm.grain, BG.warm.woodDark, .4)];
  const [f0] = s5(WIN.x0 - cw, 1.5, Z), [f1] = s5(WIN.x1 + cw, 1.5, Z), fg = g.createLinearGradient(f0, 0, f1, 0); fg.addColorStop(0, FC[0]); fg.addColorStop(.4, FC[1]); fg.addColorStop(1, FC[2]);
  g.fillStyle = fg; g.fill(fr, 'evenodd'); e.fillStyle = '#000'; e.fill(fr, 'evenodd');
  const hw = WIN.mullionW / 2;
  for (const mx of WIN.mullions) { const fm = wpath(s5, [[mx - hw, WIN.y1, Z], [mx + hw, WIN.y1, Z], [mx + hw, WIN.y0, Z], [mx - hw, WIN.y0, Z]]); g.fillStyle = FC[1]; g.fill(fm); e.fill(fm); }
  g.strokeStyle = rgba(LIGHT.warm, .5); g.lineWidth = 2;                        // 窗框下缘朝上、被吊灯照亮的一线
  { const a = s5(WIN.x0 - cw, WIN.y1 + cw, Z), b = s5(WIN.x1 + cw, WIN.y1 + cw, Z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  const [lx, ly] = s5(...SHADE.c);                                              // 吊灯光晕：颜色板一层暖雾，发光板浓
  for (const [ctx, R0, st] of [[g, 620, [[0, CORE, .92], [.1, LIGHT.warm, .8], [.38, BG.warm.glassTint, .32], [1, BG.warm.glassTint, 0]]], [e, 600, [[0, CORE, .75], [.12, LIGHT.warm, .5], [.4, BG.warm.glassTint, .14], [1, BG.warm.glassTint, 0]]]]) {
    const gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, R0); for (const [t, col, a] of st) gr.addColorStop(t, rgba(col, a));
    ctx.fillStyle = gr; ctx.fillRect(lx - R0, ly - R0, 2 * R0, 2 * R0);
  }
  const crop = src => { const [cc, cg] = canvas(W, H); cg.drawImage(src, 0, 0); return cc; };
  return { c: crop(c), e: crop(ec), tall: { c, e: ec, h: HT }, lamp: [lx, ly], win: [[WIN.x0, WIN.y1], [WIN.x1, WIN.y1], [WIN.x1, WIN.y0], [WIN.x0, WIN.y0]].map(([x, y]) => s5(x, y, Z)) };
}

// ?test=plates 四张并排；&p=warm|out|in|s5 单张原大；&p=s5start S5 起幅（高板上移 118 px）；&p=a2 光斑外 + 光斑内按 spot() 遮罩合起来（&h= 底杠高，同时画卷帘门；&smear= 拖影 px）；&p=e 只看发光板；&dx= 光圈横移
export function test(g, e, t, A) {
  const q = new URLSearchParams(location.search), p = q.get('p');
  const L = [['A 暖灯 warm', A.plateA.warm], ['A 灯灭·光斑外 darkOut', A.plateA.darkOut], ['A 灯灭·光斑内 darkIn', A.plateA.darkIn], ['S5 仰拍', A.plateS5]];
  const one = { warm: 0, out: 1, in: 2, s5: 3 }[p];
  if (p === 'halo') { drawWarmA(g, e, A, +(q.get('dx') || 50)); return {}; }
  if (p === 's5start') { const T = A.plateS5.tall; g.drawImage(T.c, 0, -S5C.shift); e.drawImage(T.e, 0, -S5C.shift); return {}; }
  if (p === 'a2') {
    const hh = +(q.get('h') || 1.85), s = spot(hh);
    g.drawImage(A.plateA.darkOut.c, 0, 0); e.drawImage(A.plateA.darkOut.e, 0, 0);
    if (s) { const sp = new Path2D(); s.poly.forEach(([x, y], i) => i ? sp.lineTo(x, y) : sp.moveTo(x, y)); sp.closePath();
      g.save(); g.clip(sp); g.drawImage(A.plateA.darkIn.c, 0, 0); g.restore(); e.save(); e.clip(sp); e.drawImage(A.plateA.darkIn.e, 0, 0); e.restore(); }
    drawShutter(g, e, A, hh, +(q.get('smear') || 0));
    return {};
  }
  if (one !== undefined) { g.drawImage(L[one][1].c, 0, 0); e.drawImage(L[one][1].e, 0, 0); return {}; }
  L.forEach(([lab, pl], i) => {
    const x = (i % 2) * 960, y = (i >> 1) * 540;
    if (p === 'e') g.drawImage(pl.e, x, y, 960, 540); else { g.drawImage(pl.c, x, y, 960, 540); e.drawImage(pl.e, x, y, 960, 540); }
    g.font = `600 26px ${FONT ? `"${FONT}"` : 'sans-serif'}`; g.textBaseline = 'top'; g.lineWidth = 5; g.strokeStyle = BG.dark.grain; g.fillStyle = SNOW.near;
    g.strokeText(lab, x + 18, y + 14); g.fillText(lab, x + 18, y + 14);
  });
  return {};
}
