// hands.js —— 老师傅的手（TREATMENT §4.2 设定，§4.3 色指定）
// hand(g, e, o)：o = { x, y, s, rot, side:'R'|'L', pose, light, t, ld?, rim?, lw?, arm? }
//   x, y  锚点（屏幕 px），每个手型的锚点不同，见 POSE 注释；rot 弧度；s = 掌宽 px（§4.2 镜头表：S1 70、S5 280……）
//   side  'L' 为左手（镜像）；light = warm | in | out | s5 | s13；ld = 屏幕上朝光源的方向（可选，覆盖默认）
//   rim   {c, w, ld?} 额外轮廓光（可选，如 S3 窗外冷光 SNOWLIGHT_RIM）；lw 描边 px（默认按掌宽取 §4.2 表里的值）
//   arm   袖长（掌宽倍数，默认 1.6；袖子末端是平切口，入画的手要给够长度让它出画）；armA 前臂方向（本地，度，覆盖手型默认）；
//   elbow {at, a, len} 在肘处折过去（见 arm()）；t 暂不用（手型是静止的刚体，换张由合成按 12 fps 换 pose / 坐标）
// 锚点：flat / open = 掌心；bead = 木珠中心；grip / lift = 掌下的杖轴；press = 指尖中心。rot = 0 时前臂从下方（+y）伸进来
// 画法（画风 §2）：平涂 → 硬边高光 → 硬边阴影 → 硬边老茧 → 轮廓光 → 彩色描边；手指成组、每根是一块刚体形；不用渐变。
// e 上用黑色印一遍整只手的剪影（挡住它后面的发光体）。
import { path, mix, rng, canvas, LWK, W, H } from './lib/cel.js';
import { C, SIL, SKIN_HI, LIGHT, BG, SNOW, TYPE, CORE as CORE_ } from './pal.js';
import { w2s, CORD, WIN } from './layout.js';

// —— 比例（单位：掌宽 = 1）——
// knuckle：骨节比指身宽多少（只微微鼓出，粗剪第 2 轮从 1.15 降下来）；taper：指根 → 指尖收细多少
export const PROP = { palmL: 1.0, mid: .68, fw: .24, knuckle: 1.06, taper: .20, callus: { web: .22, heel: .30, index: .12 } };
const FW = PROP.fw;
const FL = { i: .62, m: PROP.mid, r: .63, l: .50 }, PH = [.45, .30, .25];
const seg = (f, k = [1, 1, 1]) => PH.map((p, i) => FL[f] * PROP.palmL * p * k[i]).filter(v => v > .005);

const D = a => a * Math.PI / 180;
const V = (deg, r) => [Math.cos(D(deg)) * r, Math.sin(D(deg)) * r];
const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
const unit = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
const nrm = d => [-d[1], d[0]];
const lens = (c, d, a, b) => { const n = nrm(d); return [add(c, d, -a), add(c, n, b), add(c, d, a), add(c, n, -b)]; };   // 菱形高光块
// 骨节顶面的硬边高光：一弯月牙（横跨指背，两头尖、中间厚 2a，往 +d 拱 bow），不再是大菱形贴片
const moon = (c, d, b, a, bow) => { const n = nrm(d), o = [], u = []; for (let k = 0; k <= 8; k++) { const x = k / 4 - 1, f = 1 - x * x, p = add(c, n, x * b); o.push(add(p, d, (bow + a) * f)); u.push(add(p, d, (bow - a) * f)); } return [...o, ...u.reverse().slice(1, -1)]; };
// m 材质；p 外形；sh 手摆的硬阴影（筋络、折痕）；hi 手摆的硬高光（指节顶面）；cal 老茧；ln 细线（褶纹）；sp 老人斑（平涂）；vn 筋络（硬边阴影形，只在大特写画）
const part = (m, p, x = {}) => ({ m, p, sh: [], hi: [], cal: [], ln: [], sp: [], vn: [], so: 1, ho: 1, ...x });

// —— 手绘线的工具（第 3 轮：手不再像机械臂）——
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
// 向心 Catmull-Rom：过各点的一条平滑曲线，每段密采 m 个点；点的第 4 项是线宽系数（插值），返回点带第 5 项：段号 + 段内位置
function spl(pts, m = 6) {
  const n = pts.length; if (n < 2) return pts.map(p => [p[0], p[1], 0, p[3] ?? 1, 0]);
  const Q = i => i < 0 ? [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]] : i >= n ? [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]] : pts[i];
  const L = (A, B, ta, tb, T) => { const k = (T - ta) / ((tb - ta) || 1e-6); return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]; }, out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2), w1 = p1[3] ?? 1, w2 = p2[3] ?? 1;
    const t1 = Math.sqrt(dist(p0, p1)) || 1e-3, t2 = t1 + (Math.sqrt(dist(p1, p2)) || 1e-3), t3 = t2 + (Math.sqrt(dist(p2, p3)) || 1e-3);
    for (let k = 0; k < m; k++) {
      const T = t1 + (t2 - t1) * k / m, A1 = L(p0, p1, 0, t1, T), A2 = L(p1, p2, t1, t2, T), A3 = L(p2, p3, t2, t3, T), c = L(L(A1, A2, 0, t2, T), L(A2, A3, t1, t3, T), t1, t2, T);
      out.push([c[0], c[1], 0, w1 + (w2 - w1) * k / m, i + k / m]);
    }
  }
  const e = pts[n - 1]; out.push([e[0], e[1], 0, e[3] ?? 1, n - 1]);
  return out;
}
// 一笔手绘线：沿 pts 的平滑曲线、宽 w（本地单位），两端收尖（tp = 收尖段占全长的比例）→ 闭合的笔形点列（填色，不是 stroke）
function rib(pts, w, tp = .3) {
  const S = spl(pts, 5), N = S.length; if (N < 2) return [];
  const acc = [0]; for (let i = 1; i < N; i++) acc.push(acc[i - 1] + dist(S[i - 1], S[i]));
  const Lt = acc[N - 1] || 1, A = [], B = [];
  S.forEach((p, i) => {
    const nd = nrm(unit(S[Math.max(0, i - 1)], S[Math.min(N - 1, i + 1)])), t = acc[i] / Lt, k = Math.max(0, Math.min(1, t / tp, (1 - t) / tp));
    const hw = w / 2 * p[3] * (.12 + .88 * Math.sin(k * Math.PI / 2));
    A.push(add(p, nd, hw)); B.push(add(p, nd, -hw));
  });
  return [...A, ...B.reverse()];
}
const gs = (x, s) => Math.exp(-x * x / (2 * s * s));

// 一根手指 / 拇指：基点 b，各节方向 angs（度），各节可见长度 ls（透视缩短直接改长度）
// o = { w 指宽, id 手指编号（定褶纹、粗细差异的种子）, nail 画指甲, back 手背一侧（骨节高光 + 褶纹）, palm 掌心一侧（指腹横纹）, cal: ±1 在这一侧画食指侧老茧 }
// 外形（第 3 轮）：中心线是过各关节的平滑曲线（弯曲分散到整根手指，关节处不折角）；宽度平滑变化 ——
// 侧面看（蜷着）：手背一侧关节处微鼓，掌心一侧两节之间有肉垫、关节处一道浅凹；从手背 / 掌心正看（伸直）：两边只在关节处微微鼓出；
// 往指尖收细成圆头，掌心一侧的指肚略扁；描边是一笔手绘线：指根两端收尖，不在指根画一道横线（手指从掌里长出来，不是插上去的）
function digit(b, angs, ls, o = {}) {
  const w = o.w ?? FW, n = ls.length, J = [b], d = [], nn = [];
  ls.forEach((l, i) => J.push(add(J[i], V(angs[i], l))));
  for (let i = 0; i < n; i++) { d.push(unit(J[i], J[i + 1])); nn.push(nrm(d[i])); }
  const R = rng(4099 + (o.id ?? 0) * 131), thumb = w >= .26;   // 拇指：手型里拇指都给 w .27–.28
  // 蜷向：各关节转角累加（> 0 → 往 +n 一侧蜷，+n 是掌心一侧）；sig = 侧面看的程度（0 = 伸直、从手背 / 掌心正看）
  let bend = 0; for (let i = 1; i < n; i++) bend += Math.asin(Math.max(-1, Math.min(1, d[i - 1][0] * d[i][1] - d[i - 1][1] * d[i][0])));
  const ps = bend >= 0 ? 1 : -1, sig = Math.min(1, Math.abs(bend) / D(50));
  const FR = n >= 3 ? [0, .45, .75, 1] : n === 2 ? [0, .55, 1] : [0, 1], vw = 1 + (R() - .5) * .07, wAt = f => w * vw * (1 - PROP.taper * f);
  const prof = (f, pal) => {   // 半宽系数：pal = 这一侧是不是掌心一侧
    let lat = 1, dor = 1, pd = 1;
    for (let i = 1; i < n; i++) { const k = gs(f - FR[i], .05); lat += (PROP.knuckle - 1) * 1.15 * k; dor += (PROP.knuckle - 1) * 1.7 * k; pd -= .045 * gs(f - FR[i], .035); }
    for (let i = 0; i < n; i++) { const m = (FR[i] + FR[i + 1]) / 2 + .02; pd += .075 * gs(f - m, .085); lat -= .012 * gs(f - m, .085); }
    return lat + ((pal ? pd : dor) - lat) * sig;
  };
  const r = wAt(1) / 2, dl = d[n - 1], nl = nn[n - 1], T = J[n], cl = Math.min(r * .95, ls[n - 1] * .6), C = add(T, dl, -cl);
  const S = spl(J, 7).map(p => { const i = Math.min(n - 1, Math.floor(p[4] + 1e-9)), u = p[4] - i; return [p[0], p[1], FR[i] + (FR[i + 1] - FR[i]) * u]; })
    .filter(p => (p[0] - C[0]) * dl[0] + (p[1] - C[1]) * dl[1] < -.004);
  const Lf = [], Rt = [];
  S.forEach((p, i) => {
    const q0 = S[Math.max(0, i - 1)], q1 = i + 1 < S.length ? S[i + 1] : C, nd = nrm(unit(q0, q1)), hw = wAt(p[2]) / 2;
    Lf.push(add(p, nd, hw * prof(p[2], ps > 0))); Rt.push(add(p, nd, -hw * prof(p[2], ps < 0)));
  });
  // 指尖：圆头；掌心一侧的指肚略扁（侧面看时那一侧的弧更方一点）
  const cap = [70, 40, 12, -12, -40, -70].map(t => {
    const pal = (t > 0) === (ps > 0), e = pal ? .78 + .22 * (1 - sig) : 1, c = Math.cos(D(t)), s = Math.sin(D(t));
    return add(add(C, dl, cl * Math.pow(c, e)), nl, r * (pal ? 1 + .04 * sig : 1) * s);
  });
  Lf.push(add(C, nl, r * (ps > 0 ? 1 + .04 * sig : 1))); Rt.push(add(C, nl, -r * (ps < 0 ? 1 + .04 * sig : 1)));
  const d0 = d[0], n0 = nn[0], wb = w * PROP.knuckle;
  const base = !thumb ? [add(add(b, d0, -wb * .34), n0, -wb * .36), add(b, d0, -wb * .48), add(add(b, d0, -wb * .34), n0, wb * .36)]
    : o.back || o.palm   // 手背一侧看拇指：根部顺着第一掌骨收窄、藏进掌下，不在掌边鼓一个包；掌心一侧的根压在大鱼际肉丘上（见下）
    ? [add(add(b, d0, -.07), n0, -wb * .50), add(add(b, d0, -.17), n0, -wb * .34), add(b, d0, -.23), add(add(b, d0, -.17), n0, wb * .32), add(add(b, d0, -.07), n0, wb * .48)]
    : [add(add(b, d0, -.08), n0, -wb * .62), add(add(b, d0, -.22), n0, -wb * .52), add(b, d0, -.31), add(add(b, d0, -.22), n0, wb * .48), add(add(b, d0, -.08), n0, wb * .58)];   // 大鱼际：往腕的方向鼓出一块比拇指宽的肉
  const side = [...Lf, ...cap, ...Rt.reverse()];
  const F = part('skin', [...side, ...base], { so: .7, th: thumb });
  // 描边：一笔，从指根中间起、绕指尖、回到指根中间，两端收尖 → 指根那道横线淡出（手指长在掌上）
  // 拇指：描边顺着根部的形走一圈，收尖在最深处（藏在掌下 / 大鱼际里）
  F.ol = [(thumb ? [base[2], base[3], base[4], ...side, base[0], base[1], base[2]] : [add(b, d0, -wb * .40), base[base.length - 1], ...side, base[0], add(b, d0, -wb * .40)]).map(p => [p[0], p[1], 0, 1])];
  if (thumb) F.rz = [0, 45, 90, 135, 180, 225, 270, 315].map(a => add(add(b, d0, -.06), V(a, 1), wb * .72));   // 拇指根一带：掌压在上面时，掌的描边 / 自动阴影在这里让开
  if (!thumb && ls.reduce((x, y) => x + y, 0) > w * 1.8) F.bz = [add(add(b, n0, wb), d0, wb * .22), add(add(b, n0, -wb), d0, wb * .22), add(add(b, n0, -wb), d0, -.6), add(add(b, n0, wb), d0, -.6)];   // 指根一带不画自动阴影（不在指根画出一道弧）
  // 一道褶：短、弯，从 s0 一侧往里走 len，弯向指尖一侧 bow
  const crease = (c, nd, dd, s0, len, bow) => [add(c, nd, s0), add(add(c, nd, s0 - Math.sign(s0) * len * .5), dd, bow), add(add(c, nd, s0 - Math.sign(s0) * len), dd, bow * .4)];
  for (let i = 1; i < n; i++) {
    const hw = wAt(FR[i]) / 2, nd = nrm(unit(J[i - 1], J[i + 1])), dd = unit(J[i - 1], J[i + 1]);
    if (sig > .35) {   // 侧面看：褶只在关节弯的内侧（掌心一侧），1–2 道短弧从边上往里
      const m = 1 + (R() < .5 ? 1 : 0);
      for (let j = 0; j < m; j++) F.ln.push(crease(add(J[i], dd, (j - (m - 1) / 2) * .022), nd, dd, ps * hw * .92, hw * (.55 + R() * .25), (R() - .5) * .02));
    } else if (o.back || o.palm) {   // 正看：关节上 1–2 道短弧（PIP 多一道），不横贯整根手指
      const m = i === 1 ? 1 + (R() < .6 ? 1 : 0) : (R() < .5 ? 1 : 0), bw = (o.palm ? -1 : 1) * .012;
      for (let j = 0; j < m; j++) { const c = add(add(J[i], dd, j * .02 - (m - 1) * .01), nd, (R() - .5) * hw * .3), h = hw * (.48 + R() * .2) - j * hw * .1; F.ln.push([add(c, nd, h), add(c, dd, bw), add(c, nd, -h)]); }
    }
  }
  if (o.back) {   // 骨节顶面只留很小一弯高光（PIP 一小弯，MCP 一小弯）
    F.hi.push(moon(add(b, d0, -.03), d0, w * .15, .0055, .008));
    if (n > 1) F.hi.push(moon(add(J[1], d[0], -.012), d[0], w * .11, .0045, .006));
  }
  if (o.cal) {   // 食指侧老茧：长 0.12 × 掌宽，贴着这一侧边缘；尖角硬边块
    const sg = o.cal, t0 = .06, t1 = t0 + PROP.callus.index, e = (t, x) => add(add(b, d0, t), n0, sg * x);
    F.cal.push([e(t0 + .01, w * .62), e((t0 + t1) / 2, w * .67), e(t1, w * .6), e(t1 - .02, w * .5 - .055), e((t0 + t1) / 2, w * .5 - .075), e(t0 + .025, w * .5 - .045)]);   // 一片细长的弯块（不是方贴片）
  }
  const out = [F];
  if (thumb && o.palm) {   // 掌心一侧：大鱼际是一块不描边的肉丘（自带受光 / 背光硬边），里侧一道生命线收边；拇指的根压在它上面
    const M = (t, x) => add(add(b, d0, -t), n0, x * wb);
    out.unshift(part('skin', [M(-.02, .40), M(.08, .40), M(.17, .26), M(.25, 0), M(.31, -.25), M(.30, -.52), M(.18, -.68), M(.04, -.64), M(-.02, -.56)],
      { lw: .001, so: .7, ln: [[M(.02, -.52), M(.16, -.57), M(.26, -.42), M(.30, -.18)]] }));
  }
  // 指甲剪得很短：不出指尖。手型给了 nail 就画在指背正中；手背一侧三节全伸出来的手指自动画；
  // 手指在画面里蜷过 30° 以上 = 侧面看，指甲是背侧（蜷向的反面）边上窄窄一条
  if ((o.nail || (o.back && n === 3)) && ls[n - 1] > .04) {
    const off = o.nail || Math.abs(bend) < D(30) ? 0 : -ps * r * .46, hw = off ? r * .40 : r * .56;
    const L = Math.min(.09, ls[n - 1] * .55), z = add(add(T, dl, -cl * .45), nl, off), a = add(z, dl, -L);
    out.push(part('nail', [add(a, nl, hw * .85), add(add(z, dl, -hw * .25), nl, hw), add(z, dl, hw * .2), add(add(z, dl, -hw * .25), nl, -hw), add(a, nl, -hw * .85), add(a, dl, -.016)],
      { so: .5, lw: .5, hi: [moon(add(add(a, dl, L * .55), nl, hw * .25), dl, hw * .22, .006, .004)] }));
  }
  return out;
}

const FING = ['l', 'r', 'm', 'i'];   // 画的顺序：小指在下，食指在上
const FWK = { i: 1.0, m: 1.05, r: .95, l: .82 };   // 每根手指粗细不一样（中指最粗，小指最细）
// 四指自然错开（画法里加，不动手型数据）：食指最直、小指最弯 —— 往掌心蜷的透视（后两节再缩一点）+ 往中指一侧偏几度
// 第 3 轮：四指从指根往指尖往中间收拢（根节就偏一点，不再是平行等距的耙子），无名指略向中指偏；每根再带一点 seed 定的长短 / 弯度差异
const CURL = { i: [1, 1, 1], m: [1, .97, .94], r: [1, .93, .88], l: [.98, .88, .80] }, LEAN = { i: [2, 3, 3.5], m: [0, 0, 0], r: [2, 3.5, 5], l: [3.5, 6, 9] };
// 四指：bases[i] / angs[i] 按 FING 顺序；k = 各节缩短系数；bend = 每节再弯多少度
function four(bases, angs, k, o = {}) {
  const mb = bases[FING.indexOf('m')];
  return FING.map((f, i) => {
    const b = bases[i], a = angs[i], u = V(a, 1), sg = Math.sign((mb[0] - b[0]) * -u[1] + (mb[1] - b[1]) * u[0]);   // sg：往中指那边转是加角度还是减角度
    const R = rng(977 + (o.id ?? 0) * 53 + i * 17), jl = 1 + (R() - .5) * .06, ja = (R() - .5) * 3;
    const A = [a, a + (o.bend?.[0] ?? 0), a + (o.bend?.[1] ?? 0)].map((x, j) => x + LEAN[f][j] * sg + ja * j * .5);
    return digit(b, A, seg(f, (o.kf?.[i] ?? k).map((x, j) => x * CURL[f][j] * jl)), { ...o, w: FW * FWK[f], id: i + (o.id ?? 0) * 4, cal: f === 'i' ? o.cal : 0 });
  }).flat();
}
// 手背（第 3 轮）：一个微微隆起的面 —— 掌指骨节是一排柔和的弧（淡线），筋络是 2–3 条淡淡的弯线、往手腕方向渐隐；老人的手加一条很淡的静脉弯线 + 两块老人斑。
// a = 四个指根（小指→食指），wr = 腕中点；seed 让每个手型不一样。线都放进 vn（淡线：两端收尖、宽度系数在点的第 4 项）
function backOfHand(P, a, wr, seed = 1) {
  const R = rng(733 + seed * 59);
  const curve = (p, q, bow, w0, w1) => { const d = unit(p, q), n = nrm(d), L = dist(p, q);   // 一条弯线：p（腕，细）→ q（指根，粗）
    return [[...p, 0, w0], [...add(add(p, d, L * .35), n, bow), 0, (w0 + w1) / 2], [...add(add(p, d, L * .7), n, bow * .8), 0, w1], [...q, 0, w1 * .8]]; };
  // 筋络：从腕上各自的起点（按指根左右排开，互不交叉）走向中指、食指根（无名指那条短、更淡），离指根 0.12 处收住
  [[a[1], .55], [a[2], 1], [a[3], .9]].forEach(([t, k], i) => {
    const st = add(wr, [(t[0] - wr[0]) * .30 + (R() - .5) * .03, -.06 - .03 * i]), q = add(t, unit(t, st), .12 + R() * .04);
    P.vn.push(curve(add(st, unit(st, q), dist(st, q) * (i ? .12 : .35)), q, (R() - .5) * .05 + (i - 1) * .015, .15, k));
  });
  // 掌指骨节：一排柔和的弧起伏（每个骨节一小弯，拱向指尖），食、中指的大一点
  a.forEach((t, i) => {
    const nx = i < 3 ? a[i + 1] : add(t, add(t, a[i - 1], -1)), dd = unit(nx, t), up = unit(wr, t), hw = FW * (i ? .34 : .28) * (1 + (R() - .5) * .15);
    const c = add(t, up, -.035 - R() * .015);
    P.vn.push([[...add(c, dd, hw), 0, .3], [...add(add(c, up, .022), dd, hw * .1), 0, 1], [...add(add(c, up, .01), dd, -hw * .7), 0, .5]]);
  });
  // 静脉：一条很淡、略起伏的弯线，从腕的拇指一侧斜往食指和中指之间
  const v0 = add(wr, [(a[3][0] - wr[0]) * .55, -.02]), v1 = add(add(a[3], a[2]).map(x => x / 2), unit(add(a[3], a[2]).map(x => x / 2), wr), .22);
  P.vn.push([[...v0, 0, .2], [...add(add(v0, unit(v0, v1), dist(v0, v1) * .4), nrm(unit(v0, v1)), .03), 0, .55], [...add(add(v0, unit(v0, v1), dist(v0, v1) * .75), nrm(unit(v0, v1)), -.012), 0, .5], [...v1, 0, .3]]);
  for (let i = 0; i < 2; i++) {   // 两块老人斑：不规则的小平涂块
    const c = add(add(wr, unit(wr, a[i === 0 ? 0 : 3]), .32 + R() * .18), [(R() - .5) * .1, 0]), r = .03 + R() * .02, pts = [];
    for (let j = 0; j < 7; j++) { const an = j / 7 * Math.PI * 2 + R() * .4, f = .7 + R() * .45; pts.push([c[0] + Math.cos(an) * r * f * 1.3, c[1] + Math.sin(an) * r * f, j % 3 === 0 ? 1 : 0]); }
    P.sp.push(pts);
  }
  return P;
}

// —— 手型（右手，本地坐标：掌宽 = 1，y 向下，前臂从 +y 方向来）——
// 蜷起的一根手指（从拇指一侧看）：一块指节形，K = PIP 骨节处，L 长（往左藏进掌里），h 高
// 上沿是近节（往骨节微微拱起），右边是骨节（圆的，只微微鼓出，不取尖角），下面是中节往回折、指尖藏进掌心
function knuckle(K, L, h, above) {
  const [kx, ky] = K, P = part('skin', [[kx - L, ky - h * .34], [kx - L * .45, ky - h * .50], [kx - .045, ky - h * .54], [kx + .018, ky - h * .36], [kx + .03, ky - h * .02],
    [kx + .006, ky + h * .30], [kx - .06, ky + h * .48], [kx - L * .55, ky + h * .52], [kx - L, ky + h * .36]], {
    hi: [moon([kx - .012, ky - h * .36], unit([kx - .045, ky - h * .54], [kx + .03, ky - h * .02]), .022, .005, .006)],   // 骨节顶面一小弯硬边高光（不要菱形贴片）
    ln: [[[kx - .03, ky - h * .44], [kx - .075, ky - h * .04], [kx - .14, ky + h * .12]]] });   // 近节和中节之间的折线
  if (above) P.sh.push(above.p.map(q => [q[0] + .016, q[1] + .05, q[2]]));   // 上面那根手指投下来的硬边影：把三根隔开
  return P;
}

// —— 手型（右手，本地坐标：掌宽 = 1，y 向下，前臂从 +y 方向来）——
const POSE = {
  // flat：掌放平（S12 正俯，手背朝上）。锚点 = 掌心
  flat() {
    const palm = part('skin', ['W', [-.47, -.42], [-.28, -.50], [-.08, -.54], [.13, -.52], [.34, -.46], [.49, -.34], [.53, -.04], [.47, .30], [.37, .54, 1], [-.31, .56, 1], [-.44, .36], [-.57, .10], [-.61, -.08], [-.56, -.27]], {
      cal: [[[-.64, -.31], [-.60, -.05], [-.53, -.09], [-.55, -.20], [-.52, -.28]]] });   // 虎口老茧（从手背只看到边上一条）
    backOfHand(palm, [[.36, -.40], [.13, -.48], [-.10, -.50], [-.33, -.44]], [.02, .50], 1);
    const thumb = digit([-.47, .10], [-136, -142], [.30, .24], { w: .28, nail: true, back: true, id: 9 });
    return { arm: { w: [.03, .53], a: 92 }, parts: [...thumb, palm, ...four([[.35, -.38], [.12, -.47], [-.11, -.50], [-.34, -.43]], [-82, -87, -91, -95], [1, 1, 1], { nail: true, back: true, cal: -1 })] };
  },
  // open：掌心朝上（设定图用，看三块老茧）。锚点 = 掌心
  open() {
    const fing = four([[-.35, -.38], [-.12, -.47], [.11, -.50], [.34, -.43]], [-98, -93, -89, -85], [1, 1, 1], { palm: true, cal: 1, id: 2 });
    const palm = part('skin', ['W', [.47, -.42], [.28, -.47], [.08, -.50], [-.13, -.48], [-.34, -.44], [-.49, -.34], [-.53, -.04], [-.47, .30], [-.37, .54, 1], [.31, .56, 1], [.44, .36], [.57, .10], [.61, -.08], [.56, -.27]], {
      cal: [[[.62, -.31], [.59, -.05], [.50, -.08], [.43, -.15], [.41, -.27]],             // 虎口 0.22
        [[-.31, .33], [-.20, .28], [-.06, .29], [-.01, .33], [-.04, .37], [-.13, .42], [-.27, .41]]],    // 掌根 0.30
      ln: [[[-.48, -.30], [-.10, -.32], [.20, -.40]], [[.52, -.20], [.10, -.16], [-.40, -.02]], [[.48, -.12], [.26, .10], [.22, .48]]] });   // 掌纹三道
    const thumb = digit([.47, .10], [-44, -38], [.30, .24], { w: .28, palm: true, id: 11 });
    return { arm: { w: [-.03, .53], a: 88 }, parts: [...fing, palm, ...thumb] };
  },
  // bead：捏灯绳木珠（S1 / S13，从拇指一侧看：手背朝左，掌心朝右）。锚点 = 木珠中心；食指从上、拇指从下捏住
  // 收起的中、无名、小指：三块叠着的指节形，一级比一级低、往里收，中间用硬边投影隔开
  bead() {
    const mid = knuckle([.40, .40], .40, .19), ring = knuckle([.41, .56], .40, .18, mid), lit = knuckle([.36, .71], .34, .16, ring);
    const palm = part('skin', ['W', [-.44, .26], [-.30, .22], [-.08, .30], [.14, .46], [.22, .72], [.25, 1.02, 1], [-.36, 1.04, 1], [-.48, .66]], {
      cal: [[[-.15, .25], [.09, .36], [.07, .47], [-.05, .43], [-.17, .35]]],   // 虎口老茧
      sp: [[[-.36, .62], [-.30, .58, 1], [-.26, .63], [-.31, .68, 1]]] });     // 手背侧一块老人斑
    const index = digit([-.34, .30], [-86, -42, 18], [.28, .19, .17], { back: true, cal: 1, id: 5 });
    const thumb = digit([.10, .78], [-80, -100, -115], [.27, .22, .19], { w: .27, nail: true, id: 7 });
    return { off: [-.10, .02], arm: { w: [-.06, 1.0], a: 96 }, parts: [lit, ring, mid, palm, ...index, ...thumb] };   // off：整只手往左下挪，木珠右半边露出来
  },
  // grip：握擀面杖（S4 正俯，杖横放，手指从远侧扣下去）。锚点 = 掌下的杖轴
  // 拇指不横伸：从掌边往上扣到杖的下沿，只露短短一截（S13 窗外扣卷帘底杠同一个手型）
  grip() {
    const palm = part('skin', ['W', [-.47, -.06], [-.25, -.13], [-.02, -.16], [.20, -.14], [.40, -.08], [.50, .06], [.52, .40], [.42, .84, 1], [-.30, .86, 1], [-.44, .62], [-.55, .30], [-.57, .08]], {
      cal: [[[-.60, .03], [-.59, .25], [-.52, .21], [-.53, .12], [-.50, .05]]] });
    backOfHand(palm, [[.34, -.07], [.13, -.13], [-.10, -.14], [-.33, -.09]], [.06, .80], 3);
    const thumb = digit([-.50, .44], [-102, -80], [.18, .11], { w: .28, nail: true, back: true, id: 13 });
    return { arm: { w: [.06, .85], a: 92 }, parts: [...thumb, palm, ...four([[.34, -.05], [.13, -.12], [-.10, -.13], [-.33, -.08]], [-84, -88, -91, -94], [.55, .35, 0], { back: true, cal: -1, id: 1 })] };
  },
  // press：三指压面窝（S2 正俯，指尖扎进面里）。锚点 = 指尖中心
  press() {
    const palm = part('skin', ['W', [-.46, .42], [-.24, .36], [0, .32], [.22, .36], [.44, .44], [.52, .62], [.50, .95], [.40, 1.24, 1], [-.32, 1.26, 1], [-.46, 1.0], [-.56, .72], [-.54, .52]]);
    backOfHand(palm, [[.34, .48], [.13, .42], [-.10, .40], [-.33, .44]], [.04, 1.20], 5);
    const thumb = digit([-.46, .88], [-100, -80], [.30, .22], { w: .28, nail: true, back: true, id: 15 });
    return { arm: { w: [.04, 1.24], a: 93 }, parts: [palm, ...thumb, ...four([[.34, .50], [.13, .44], [-.10, .42], [-.33, .46]], [-80, -87, -91, -96], [.82, .62, .45], { back: true, cal: -1, kf: [[.55, .35, 0]], id: 2 })] };
  },
  // lift：托杖举起。拳头握杖、指节朝镜头：手背 + 掌指关节一排 + 四根近节往上扣到杖前，近节顶上是 PIP 骨节（方硬的角）。锚点 = 杖轴
  // o.fore > 0 → S5 仰拍版（见 liftS5：前臂前缩、拇指压杖、袖卷占下角）；不给 fore 就是原来的设定图手型
  lift(o = {}) {
    const fl = o.fore ?? 0;
    if (fl > 0) return liftS5(fl, o.armA ?? 73);
    const back = part('skin', ['W', [-.52, .40], [-.40, .30], [-.14, .27], [.12, .28], [.36, .31], [.52, .40], [.54, .60], [.44, .86, 1], [-.34, .88, 1], [-.52, .66], [-.58, .50]]);
    backOfHand(back, LIFT_F.map(f => [f[0], f[1] + .02]).reverse(), [.05, .84], 7);
    const thumb = digit([-.52, .56], [-112, -72], [.20, .12], { w: .28, back: true, id: 17 });   // 拇指在食指一侧往上扣到杖下，不横伸
    const fing = LIFT_F.map(([x, y, top, w], i) => {   // 近节：底边是一排掌指骨节的弧，顶上是 PIP 方硬的骨节角
      const hw = w / 2, kw = hw * PROP.knuckle, P = part('skin', [[x - hw * .95, y + .03], [x - kw, top + .05, 1], [x - kw * .55, top - .005, 1], [x + .01, top - .02], [x + kw * .55, top - .005, 1], [x + kw, top + .05, 1], [x + hw * .95, y + .03], [x + hw * .4, y + .07], [x - hw * .4, y + .07]], {
        sh: [[[x - kw, top + .05], [x - kw * .55, top - .005], [x + .01, top - .02], [x + kw * .55, top - .005], [x + kw, top + .05], [x + kw * .6, top + .075], [x - kw * .6, top + .075]]],   // 骨节顶面往后折的一窄条（中节离开镜头）
        hi: [[[x - kw * .5, top + .085], [x + kw * .2, top + .08], [x + kw * .05, top + .11], [x - kw * .45, top + .115]]],   // 骨节下沿一块硬高光
        ln: [[[x - hw * .5, y - .07], [x - hw * .1, y - .09], [x + hw * .3, y - .065]]] });   // 近节上一道褶
      P.ln.push(...(i % 2 ? [] : [[[x - hw * .3, top + .16], [x + hw * .35, top + .15]]]));   // 隔一根多一道：每根的褶不一样
      return P;
    });
    return { arm: { w: [.05, .86], a: 90 }, parts: [...thumb, back, ...fing.reverse()] };   // 小指先画、食指最后：食指压在最上
  },
};
// lift 四指（食 → 小）：[x, 掌指骨节 y, PIP 骨节顶 y, 指宽]。中指最高、小指最矮最细
const LIFT_F = [[-.35, .30, .06, FW * FWK.i], [-.11, .27, .03, FW * FWK.m], [.13, .28, .05, FW * FWK.r], [.35, .32, .11, FW * FWK.l]];
export const POSES = Object.keys(POSE);

// —— lift · S5 仰拍版（第 3 轮导演裁决）——
// 机位在胸前往上看：拳头在最远处握着杖，肘离镜头近 → 前臂短、往肘越来越粗（前缩）；袖子挽到肘、卷成一圈比前臂宽的厚袖卷，
// 袖子从袖卷往下角出画（离镜头最近，最宽）。锚点 = 杖轴（本地 y = 0），不再整只上提。右手本地坐标：−x 是虎口 / 食指一侧（朝面片中心）。
// 四根近节挡在杖前：PIP 骨节高低错开（中指最高、食指次之、无名指再低、小指最矮最细），每根背光一侧一条硬边影把指头分开；
// 拇指从虎口往里压在杖上、两节，第二节顺着杖横躺，指尖朝面片中心。通用袖子 arm() 放到画外（w 在袖子尽头再往外）
// fl = 前臂露出长度（掌宽倍数），fa = 前臂方向（本地，度；90 = 竖直往下）
const LIFT5_F = [[-.36, -.18, .10, .25], [-.115, -.23, .08, .26], [.125, -.17, .10, .24], [.345, -.08, .14, .21]];   // [x, PIP 顶 y, 掌指骨节 y, 宽]（食 → 小）
function liftS5(fl, fa) {
  const d = V(fa, 1), n = nrm(d), wr = [.02, .60], at = (t, x) => add(add(wr, d, t), n, x), hw0 = .31, hw1 = .64;   // +n = 里侧（虎口），−n = 外侧（小指）
  // 手背 + 前臂一整块（腕上不留接缝）：腕 ±.31 → 肘端 ±.64；外侧一道肌肉鼓包，里侧较直；腕上一道横褶影把拳头和前臂分开，外侧一道长肌肉影
  const fore = part('skin', [[-.47, .10], [-.30, .06], [-.05, .05], [.18, .06], [.40, .10], [.50, .22], [.46, .42],
    at(.06, -hw0), at(fl * .35, -(hw0 + .15)), at(fl * .72, -(hw1 + .01)), [...at(fl + .1, -hw1), 1], [...at(fl + .1, hw1 - .04), 1], at(fl * .6, hw0 + .13), at(.1, hw0), [-.42, .40], [-.52, .22]], {
    sh: [[at(-.03, hw0 + .02), at(-.05, 0), at(-.02, -hw0 - .03), at(.05, -hw0 - .01), at(.03, 0), at(.06, hw0)],
      [at(.32, -hw0 + .03), at(fl * .45, -(hw0 - .02)), at(fl * .86, -(hw1 - .17)), at(fl * .86, -(hw1 + .02)), at(fl * .45, -(hw0 + .17)), at(.32, -hw0 - .1)]] });
  const thumb = digit([-.44, .26], [-125, -176], [.24, .26], { w: .27, id: 21 });
  const fing = LIFT5_F.map(([x, top, bot, w]) => {
    const h = w / 2, kc = h * 1.08;
    return part('skin', [[x - h * .96, bot], [x - kc, top + .07, 1], [x - kc * .62, top + .005, 1], [x, top - .012], [x + kc * .62, top + .005, 1], [x + kc, top + .07, 1], [x + h * .96, bot], [x + h * .35, bot + .05], [x - h * .35, bot + .05]], {
      sh: [[[x - kc, top + .07], [x - kc * .62, top + .005], [x, top - .012], [x + kc * .62, top + .005], [x + kc, top + .07], [x + kc * .58, top + .095], [x - kc * .58, top + .095]],   // 骨节顶面往后折的一窄条
        [[x + h * .5, top + .15], [x + h * .97, top + .11], [x + h * .97, bot - .02], [x + h * .66, bot - .05]]] });                                    // 背光一侧的硬边影
  });
  // 袖卷 + 袖子：袖子方向比前臂再往外偏 16°（上臂往肩头去），袖卷外缘三处鼓包、两道卷褶、下半圈背光；
  // 光从上面来：袖卷顶上和袖子靠袖卷的一截是袖色，往下（离镜头近、背光）整块压成褶影色 → 下角是暗的一大块，不抢面片
  const du = V(fa - 16, 1), nu = nrm(du), E = at(fl + .12, 0), U = (t, x) => add(add(E, du, t), nu, x);
  const roll = part('cuff', [at(fl - .06, .66), at(fl - .1, .2), at(fl - .08, -.26), at(fl - .02, -.7), [...at(fl + .14, -.77), 1], at(fl + .33, -.66), at(fl + .37, -.18), at(fl + .34, .28), [...at(fl + .3, .72), 1]], {
    sh: [[at(fl + .02, .12), at(fl + .16, .08), at(fl + .31, .15), at(fl + .16, .02)], [at(fl + .04, -.4), at(fl + .18, -.45), at(fl + .31, -.38), at(fl + .18, -.5)],
      [at(fl + .22, .8), at(fl + .2, .1), at(fl + .24, -.5), at(fl + .2, -.9), at(fl + .5, -.9), at(fl + .5, .8)],
      [at(fl - .02, .95), at(fl - .02, -.95), at(fl + .5, -.95), at(fl + .5, .95)]] });   // 第 5 轮：袖卷整块压成褶影色（≈ #53444F），只留顶上一窄条袖色
  const sleeve = part('sleeve', [U(.08, .7), U(.08, -.76), [...U(3.6, -1.1), 1], [...U(3.6, 1.0), 1]], {
    sh: [[U(.3, -1.2), U(.42, -.3), U(.62, .3), U(.95, .78), U(3.8, 1.2), U(3.8, -1.2)], [U(.1, -.3), U(.22, -.1), U(.5, -.08), U(.24, -.22)],
      [U(-.1, 1.4), U(-.1, -1.4), U(3.9, -1.5), U(3.9, 1.5)]] });   // 第 5 轮：袖子整块压暗（下角不抢面片）
  return { arm: { w: U(4.6, 0), a: fa - 16 }, parts: [fore, ...thumb, ...fing.reverse(), sleeve, roll] };
}

// 旧白袖 + 发黄袖口。手掌的外形一路延到袖口里（腕上不留接缝），袖口最后画、盖住它
// 腕比掌窄：掌根两角之后先收一道腕（±.43·ww），再往袖口里渐粗；袖口比腕松一圈，两边露出一窄条袖里。
// 袖子往肘渐粗（前臂往肘粗：袖口 ±.47 → 约 2.4 掌宽处的肘 ±.62），不是一根直筒；el = { at 前臂长（掌宽倍数）, a 上臂方向（本地，度）, len 上臂长 } 时在肘处折过去，
// 肘尖一侧出骨头尖角，内侧两道放射的硬边褶；不给 el 就一路直到 len，2–3 道从袖边起的硬边斜褶
function arm(A, len, palm, el, th) {
  const d = V(A.a, 1), n = nrm(d), P = (t, x, sh) => [...add(add(A.w, d, t), n, x), sh];
  const us = th ? -Math.sign((th.p[0][0] - A.w[0]) * n[0] + (th.p[0][1] - A.w[1]) * n[1]) : 0;   // 尺侧（小指一侧）：拇指的反面
  const ww = A.ww ?? .74, c0 = .40, c1 = .58, wc = .44, w0 = .47, wE = .62;
  const wAt = t => w0 + (wE - w0) * Math.min(1, Math.max(0, t - c1) / 2.4);
  if (palm) {
    // 第 3 轮：掌根之后先收成腕（比掌窄），小指一侧腕上一个尺骨小突起，再往袖口里渐粗（前臂往肘粗）
    const i = palm.p.findIndex(q => q[2]), a = palm.p[i], b = palm.p[i + 1];
    const f = sg => sg === us ? [P(.08, sg * ww * .41), P(.21, sg * (ww * .43 + .022)), P(.31, sg * ww * .45), P(c0 + .1, sg * ww * .49, 1)] : [P(.12, sg * ww * .41), P(.3, sg * ww * .45), P(c0 + .1, sg * ww * .49, 1)];
    const far = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]), [fa, fb] = far(a, f(1)[0]) < far(a, f(-1)[0]) ? [f(1), f(-1)] : [f(-1), f(1)];
    palm.p.splice(i, 2, [a[0], a[1]], ...fa, ...fb.reverse(), [b[0], b[1]]);
    palm.sh.push([P(c0 - .14, -.7, 1), P(c0 - .04, .7, 1), P(c0 + .3, .7, 1), P(c0 + .3, -.7, 1)]);   // 袖口投在腕上的硬影
  }
  // 一道硬边褶：从袖边起一个楔形（袖形外的部分被裁掉），弯着往袖子中间收成尖；返回 [影形, 褶线]
  const fold = (t0, sg, t1, x1, wd) => {
    const e = t => sg * (wAt(t) + .08), m2 = P(t0 + wd + (t1 - t0 - wd) * .5, sg * (x1 + (wAt(t0) - x1) * .5) - sg * .015), tip = P(t1, sg * x1, 1);
    return [[P(t0, e(t0), 1), P(t0 + (t1 - t0) * .45, sg * (x1 + (wAt(t0) - x1) * .58) + sg * .02), tip, m2, P(t0 + wd, e(t0 + wd), 1)], [m2, tip]];
  };
  let sleeve;
  if (!el) {
    const end = c1 + len, m = Math.min(end, c1 + 2.4), mid = end > m + .05 ? [m] : [];
    const FD = [[c1 + .03, 1, c1 + .50, .04, .16], [c1 + .45, -1, c1 + 1.10, .06, .20], ...(len > 1.5 ? [[c1 + 1.25, 1, c1 + 1.85, .10, .18]] : [])], fs = FD.map(f => fold(...f));
    // 袖边跟着褶走：每道褶到袖边的地方，布往外堆出一个硬角再收回 → 袖子外形不再是两条直线
    const edge = sg => [...mid.map(t => [t, wAt(t), 0]), ...FD.filter(f => f[1] === sg).flatMap(([t0, , , , wd]) => [[t0 + wd * .85, wAt(t0 + wd * .85) + .035, 1], [t0 + wd + .05, wAt(t0 + wd + .05), 1]])]
      .filter(q => q[0] > c1 + .02 && q[0] < end - .03).sort((p, q) => p[0] - q[0]).map(([t, x, k]) => P(t, sg * x, k));
    sleeve = part('sleeve', [P(c1, -w0, 1), P(c1, w0, 1), ...edge(1), P(end, wAt(end), 1), P(end, -wAt(end), 1), ...edge(-1).reverse()], {
      sh: fs.map(f => f[0]), ln: fs.map(f => f[1]) });   // 2–3 道硬边斜褶 + 褶线
  } else {
    const E = c1 + el.at, we = wAt(E), wu = we, Ec = P(E, 0), du = V(el.a, 1), nu = nrm(du);
    const sn = Math.sign(d[0] * du[1] - d[1] * du[0]) || 1, cosT = d[0] * du[0] + d[1] * du[1];   // sn：往哪边折（+n 一侧是肘窝）
    const bis = add(n, nu), bl = Math.hypot(...bis) || 1, wm = (we + wu) / 2;
    const inner = [...add(Ec, bis, sn * wm / (1 + cosT)), 1];                     // 肘窝：两条内边的交点
    const tip = [...add(add(Ec, bis, -sn * wm * 1.16 / bl), add(d, du, -1), -.06), 1];   // 肘尖：骨头顶出的尖角
    const side = sg => sg === sn ? [inner] : [P(E - .12, sg * we), tip, add(add(Ec, du, .14), nu, sg * wu)];
    const U = (t, x) => add(add(Ec, du, t), nu, x), Lu = el.len ?? 3;
    sleeve = part('sleeve', [P(c1, w0, 1), ...side(1), [...U(Lu, wu), 1], [...U(Lu, -wu), 1], ...side(-1).reverse(), P(c1, -w0, 1)], {
      sh: [[inner, P(E - .62, sn * .06, 1), P(E - .40, sn * .30)],                       // 肘窝两道放射褶：一道往前臂
        [inner, U(.55, sn * .02), [...U(.36, sn * .30), 1]],                              // 一道往上臂
        [P(c1 + .10, -sn * .58, 1), P(c1 + .50, -sn * .22), P(c1 + .86, sn * .06, 1), P(c1 + .50, -sn * .34)]],   // 前臂中段一道斜褶
      ln: [[P(E - .40, sn * .30), P(E - .62, sn * .06)]] });
  }
  return [
    [part('lining', [P(c0 - .10, 0), P(c0 - .05, wc * .92), P(c0 + .03, wc * .98, 1), P(c0 + .09, 0), P(c0 + .03, -wc * .98, 1), P(c0 - .05, -wc * .92)], { so: 0, ho: 0 }), sleeve],   // 袖里：腕两边露出的一窄条
    // 发黄的袖口：布边是柔和的波（不是直尺），两三道短的软褶从腕一侧的布边起
    [part('cuff', [P(c0, -wc, 1), P(c0 - .022, -wc * .55), P(c0 - .04, -wc * .08), P(c0 - .026, wc * .42), P(c0, wc, 1), P(c1, w0, 1), P(c1 + .018, w0 * .45), P(c1 - .006, -w0 * .1), P(c1 + .014, -w0 * .55), P(c1, -w0, 1)], {
      so: .35, ln: [[P(c0 + .06, -wc + .05), P(c0 + .045, -wc * .2), P(c0 + .07, wc * .35), P(c0 + .06, wc - .05)], [P(c0 - .01, -wc * .62), P(c0 + .06, -wc * .5), P(c0 + .1, -wc * .38)], [P(c0 - .02, wc * .22), P(c0 + .05, wc * .3), P(c0 + .085, wc * .44)]] })],
  ];
}

// 灯灭时的光从窗来：从灯绳木珠（S1 / S13 手的位置）指向窗洞中心，屏幕方向，全用 layout 算 → 轮廓光固定朝窗
const BEAD_S = w2s(CORD.top[0], CORD.bottomY, CORD.top[2]), WIN_S = w2s((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z);
export const TOWIN = unit(BEAD_S, WIN_S);
const LD = { warm: [-.35, -.94], in: TOWIN, out: TOWIN, s5: [0, -1], s13: [.25, -.97] };   // 默认：屏幕上朝光源
// 轮廓光：w = 线中心往里实打实的宽度（px）；ld 给了就固定这个屏幕方向
const RIM = { out: { c: BG.night.snowGrey, w: 2, ld: TOWIN }, s5: { c: SIL.s5.rim, w: 3 }, s13: { c: SIL.s13.rim, w: 2.5 } };
const isSil = l => l === 's5' || l === 's13';

export function mats(light) {
  if (isSil(light)) {   // 剪影套：整块不做受光；s 只给手摆的褶 / 指缝（往线色压 40%）
    const S = SIL[light], sk = { f: S.skin, s: mix(S.skin, S.line, .4), h: S.skin, l: S.line }, sl = { f: S.sleeve, s: mix(S.sleeve, S.line, .4), h: S.sleeve, l: S.line };
    return { skin: sk, callus: sk, nail: sk, sleeve: sl, cuff: sl, lining: sl, rim: S.rim };
  }
  const skin = C('skin', light); if (light === 'warm') skin.h = SKIN_HI;
  // 指节顶面的硬边高光：暖灯用皮肤高光；灯灭时是窗光打在骨节顶上，往轮廓光色推一半，70 px 掌宽也认得出骨节
  skin.kh = light === 'warm' ? SKIN_HI : mix(skin.f, light === 'out' ? BG.night.snowGrey : LIGHT.in, .5);
  const callus = C('callus', light);
  const sleeve = C('sleeve', light);
  return { skin, callus, nail: { f: mix(callus.f, skin.h, .5), s: callus.s, h: callus.h, l: skin.l }, sleeve, cuff: C('cuff', light), lining: { ...sleeve, f: sleeve.s }, rim: RIM[light]?.c };
}

const cres = (P, d) => { const Q = new Path2D(); Q.addPath(P); Q.addPath(P, new DOMMatrix().translate(d[0], d[1])); return Q; };
function paint(g, q, K) {
  const c = K.col[q.m], P = q.P;
  g.fillStyle = c.f; g.fill(P);
  g.save(); g.clip(P);
  if (K.sil) { g.fillStyle = c.s; for (const s of q.sh) g.fill(s); }   // 剪影：只留手摆的硬边褶 / 指缝影
  else {
    g.fillStyle = c.h;
    if (q.ho) g.fill(cres(P, [K.ho[0] * q.ho, K.ho[1] * q.ho]), 'evenodd');
    g.fillStyle = c.kh ?? c.h; for (const s of q.hi) g.fill(s);   // 指节顶面：硬边高光块
    if (K.detail) { g.fillStyle = mix(c.f, c.s, .45); for (const s of q.sp) g.fill(s); }   // 老人斑：平涂
    if (K.detail && q.vn.length) { g.fillStyle = mix(c.f, c.s, .62); for (const s of q.vn) g.fill(s); }   // 手背筋络 / 骨节弧 / 静脉：淡淡的细弯线（皮色和影色各半），往腕渐隐；阴影最后盖上去
    const so = q.so ? cres(P, [K.so[0] * q.so, K.so[1] * q.so]) : null, shades = (so ? [[so, 'evenodd']] : []).concat(q.sh.map(s => [s, 'nonzero']));
    g.fillStyle = c.s;
    if (so) {   // 自动阴影：沿背光一侧的一条影带（顺着形绕到指尖）；手指的指根一带（bz）不画，免得指根出一道弧像插进去的木栓；掌在拇指根上也不画
      const z = q.bz ?? (q.palm ? K.seam : null); if (z) { g.save(); clipOut(g, z); }
      g.fill(so, 'evenodd'); if (z) g.restore();
    }
    for (const s of q.sh) g.fill(s);
    if (q.cal.length) {   // 老茧：尖角硬边色块（不描边，免得像贴了胶布）+ 背光一侧一条硬边茧影（茧是凸起的硬皮）；落在阴影里的部分换阴影色
      const U = new Path2D(), cs = K.col.callus; q.cal.forEach(k => U.addPath(k));
      g.save(); g.clip(U); g.fillStyle = cs.f; g.fill(P);
      g.fillStyle = cs.s; g.fill(cres(U, [K.so[0] * .3, K.so[1] * .3]), 'evenodd'); for (const [S, r] of shades) g.fill(S, r); g.restore();
    }
  }
  // 内部线（褶纹、折痕、掌纹）：hand() 里已做成两端收尖的细笔形（描边的 0.55 倍），裁在形里
  if (q.ln.length && !K.sil && K.detail) { g.fillStyle = c.l; for (const s of q.ln) g.fill(s); }
  g.restore();
  if (q.ol) { g.fillStyle = c.l; for (const s of q.ol) g.fill(s); }   // 手指：一笔手绘描边（指根两端收尖）
  else {   // 掌压在拇指根上的那一段不描（拇指从掌里长出来，大鱼际的肉把它接进掌里，不像插上去的木栓）
    g.save(); if (q.palm && K.seam) clipOut(g, K.seam);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = c.l; g.lineWidth = K.lw * (q.lw ?? 1) * LWK.k; g.stroke(P); g.restore();
  }
}
const clipOut = (g, Z) => { const Q = new Path2D(); Q.rect(-1e5, -1e5, 2e5, 2e5); Q.addPath(Z); g.clip(Q, 'evenodd'); };

// 轮廓光：只沿整只手（连袖）的外轮廓、朝光一侧画一条硬边光带，手指之间不重复画。
// 光带 = 整只手 − 「整只手往背光方向挪 d」在光向 ±40° 扇形里各挪一份的交集 → 朝光那一侧的边都是一样宽（不是只有正对光的那一点够宽），侧面渐窄、背光面没有；
// 最后把描边挖回来：光带在整条线的里面，实打实 rim.w px
let RC = null, RM = null, RT = null;
const fanDirs = u => [-40, 0, 40].map(a => { const r = D(a), c = Math.cos(r), s = Math.sin(r); return [u[0] * c - u[1] * s, u[0] * s + u[1] * c]; });
function rimPass(g, parts, rim, xf, lw) {
  const cw = g.canvas.width, ch = g.canvas.height, mk = R => (!R || R[0].width !== cw || R[0].height !== ch) ? canvas(cw, ch) : R;
  RC = mk(RC); RM = mk(RM); RT = mk(RT);
  const d = rim.w + lw / 2, ps = parts.filter(q => q.m !== 'nail'), T0 = g.getTransform();
  const begin = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cw, ch); x.setTransform(T0); xf(x); };
  const fillAll = (x, v) => { const M = new DOMMatrix().translate(v[0] * d, v[1] * d); for (const q of ps) { const S = new Path2D(); S.addPath(q.P, M); x.fill(S); } };
  const [c, x] = RC, [cm, m] = RM, [ct, tt] = RT;
  fanDirs(rim.u).forEach((v, k) => {   // 交集：第一份直接画进 m，后面每份先画进 tt 再 destination-in
    const tgt = k ? tt : m; begin(tgt); tgt.fillStyle = '#000'; fillAll(tgt, v); tgt.restore();
    if (k) { m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'destination-in'; m.drawImage(ct, 0, 0); m.globalCompositeOperation = 'source-over'; }
  });
  begin(x); x.fillStyle = rim.c; for (const q of ps) x.fill(q.P);
  x.lineWidth = lw; x.lineJoin = 'round'; x.globalCompositeOperation = 'destination-out'; for (const q of ps) x.stroke(q.P);
  x.restore(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(cm, 0, 0); x.globalCompositeOperation = 'source-over';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(c, 0, 0); g.restore();
}

export function hand(g, e, o) {
  const s = o.s ?? 100, sd = o.side === 'L' ? -1 : 1, light = o.light ?? 'warm', rot = o.rot ?? 0;
  const pose = typeof o.pose === 'function' ? o.pose : POSE[o.pose ?? 'flat']; if (!pose) throw new Error('hands: 没有手型 ' + o.pose);
  const def = pose(o), sil = isSil(light), detail = s >= 110;
  for (const q of def.parts) if (q.p[0] === 'W') { q.p.shift(); q.palm = true; }
  const [under, over] = arm(o.armA == null ? def.arm : { ...def.arm, a: o.armA }, o.arm ?? 1.6, def.parts.find(q => q.palm), o.elbow, def.parts.find(q => q.th));
  const parts = [...under, ...def.parts, ...over].filter(q => !(q.m === 'nail' && (sil || !detail)));
  // 屏幕上的光向 → 本地（先逆旋转，再按左右镜像）
  const toL = v => { const cr = Math.cos(-rot), sr = Math.sin(-rot), u = [(v[0] * cr - v[1] * sr) * sd, v[0] * sr + v[1] * cr], k = Math.hypot(...u) || 1; return [u[0] / k, u[1] / k]; };
  const dl = toL(o.ld ?? LD[light]), col = mats(light), rim = o.rim ?? RIM[light], rl = rim?.ld ? toL(rim.ld) : dl;
  const K = { col, sil, detail, lw: o.lw ?? (s <= 110 ? 2.5 : s <= 320 ? 2 : 1.6), so: [dl[0] * s * .10, dl[1] * s * .10], ho: [-dl[0] * s * .035, -dl[1] * s * .035],
    rim: rim ? { c: rim.c, w: rim.w, u: [-rl[0], -rl[1]] } : null };   // u：背光方向（本地）
  const X = (p, closed = true) => path(p.map(q => [q[0] * s, q[1] * s, q[2]]), closed);
  const Xs = p => path(p.map(q => [q[0] * s, q[1] * s, 1]));   // 老茧、指节高光：尖角硬边块
  const lw0 = K.lw * LWK.k / s, Xr = (p, w, tp) => X(rib(p, w, tp));   // 手绘笔形：内部线 0.55 倍、手背淡线 0.75 倍、手指描边 1 倍（两端收尖）
  for (const q of parts) {
    q.P = X(q.p); for (const k of ['sh', 'sp']) q[k] = q[k].map(p => X(p)); q.hi = q.hi.map(Xs); q.cal = q.cal.map(Xs);
    q.vn = q.vn.map(p => Xr(p, lw0 * .85, .4)); q.ln = q.ln.map(p => Xr(p, lw0 * .55, .35));
    if (q.ol) q.ol = q.ol.map(p => Xr(p, lw0 * (q.lw ?? 1), .06)); if (q.bz) q.bz = X(q.bz);
  }
  const pi = parts.findIndex(q => q.palm), th = parts.filter((q, k) => q.th && k < pi);   // 画在掌下面的拇指：掌的描边 / 自动阴影在它的根上让开
  if (th.length) { K.seam = new Path2D(); for (const q of th) if (q.rz) K.seam.addPath(X(q.rz)); }
  const xf = c => { c.save(); c.translate(o.x, o.y); c.rotate(rot); c.scale(sd, 1); if (def.off) c.translate(def.off[0] * s, def.off[1] * s); };
  xf(g); for (const q of parts) paint(g, q, K); g.restore();
  if (K.rim) rimPass(g, parts, K.rim, xf, K.lw * LWK.k);
  if (e) { xf(e); e.fillStyle = '#000'; for (const q of parts) e.fill(q.P); e.restore(); }   // 剪影印进发光层
}

// —— S5 招牌镜头：两只手托杖举到灯前（TREATMENT §4.2 / §4.4；第 3 轮导演裁决）——
// 手握在杖两端、面片外侧：剪影拳（lift · S5 仰拍版）+ 3 px 暖金轮廓光（朝面片中心和上方，灯在面片正后方），整只手连袖子印进发光板挡光。
// 合成顺序：背景板 → props.doughBacklit → 面粉颗粒 → s5Hands（手在最前）
// o = { grips: [[x, y]…] 杖轴上的握点（不含 dy，和 doughBacklit 同一套）, cx 面片中心 x, dy 上摇位移, s 掌宽, armA 前臂方向, fore 前臂露出长, t }
export const S5HAND = { s: 230, rot: .04, armA: 68, fore: 1.5 };   // armA 68°：前臂朝画面下角斜出去，袖子落在下角、大半出画；fore 1.5 掌宽（前缩，原来 3.1）
export function s5Hands(g, e, o) {
  for (const [gx, gy] of o.grips) {
    const sg = gx < o.cx ? -1 : 1;
    hand(g, e, { x: gx, y: gy + (o.dy || 0), s: o.s ?? S5HAND.s, rot: -sg * S5HAND.rot, side: sg < 0 ? 'L' : 'R', pose: 'lift', light: 's5', t: o.t,
      ld: [-sg * .8, -.6], armA: o.armA ?? S5HAND.armA, fore: o.fore ?? S5HAND.fore });
  }
}

// —— 设定图 ——
// 设定图里的道具替身（真道具在 props.js）：木珠 + 灯绳、擀面杖
function beadStub(g, x, y, r, light) {
  const W_ = isSil(light) ? { f: SIL[light].sleeve, s: SIL[light].sleeve, l: SIL[light].line } : C('pin', light), K = isSil(light) ? { f: SIL[light].sleeve, l: SIL[light].line } : C('cord', light);
  g.strokeStyle = K.l; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y - r * 9); g.lineTo(x, y); g.stroke();
  g.strokeStyle = K.f; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = W_.f; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = W_.s; g.beginPath(); g.arc(x, y, r, 0, 7); g.arc(x - r * .25, y - r * .3, r, 0, 7, true); g.fill();
  g.strokeStyle = W_.l; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
}
function pinStub(g, x0, x1, y, r, light) {
  const c = isSil(light) ? { f: SIL[light].sleeve, s: SIL[light].sleeve, h: SIL[light].sleeve, l: SIL[light].line } : C('pin', light);
  g.fillStyle = c.f; g.beginPath(); g.roundRect(x0, y - r, x1 - x0, 2 * r, r); g.fill();
  g.fillStyle = c.s; g.fillRect(x0 + r, y + r * .35, x1 - x0 - 2 * r, r * .55);
  g.fillStyle = c.h; g.fillRect(x0 + r, y - r * .62, x1 - x0 - 2 * r, r * .22);
  g.strokeStyle = c.l; g.lineWidth = 2; g.beginPath(); g.roundRect(x0, y - r, x1 - x0, 2 * r, r); g.stroke();
}

function doughStub(g, x, y, r, lip) {   // 面团：lip=false 画在手下的面堆和面窝，lip=true 画压在指尖上的一圈面唇
  const c = C('dough', 'warm'), P = new Path2D();
  if (!lip) {
    P.ellipse(x, y - r * .05, r * 1.15, r * .70, 0, 0, Math.PI * 2);
    const hole = new Path2D(); hole.ellipse(x, y - r * .02, r * .50, r * .30, 0, 0, Math.PI * 2);
    g.fillStyle = c.f; g.fill(P); g.save(); g.clip(P); g.fillStyle = c.h; g.beginPath(); g.ellipse(x - r * .55, y - r * .45, r * .32, r * .09, -.25, 0, 7); g.fill();
    g.fillStyle = c.s; g.fill(hole); g.restore(); g.strokeStyle = c.l; g.lineWidth = 2; g.stroke(P); g.stroke(hole); return;
  }
  P.moveTo(x - r * .52, y - r * .02); P.bezierCurveTo(x - r * .40, y - r * .40, x + r * .40, y - r * .40, x + r * .52, y - r * .02);
  P.bezierCurveTo(x + r * .36, y - r * .22, x - r * .36, y - r * .22, x - r * .52, y - r * .02);
  g.fillStyle = c.f; g.fill(P); g.strokeStyle = c.l; g.lineWidth = 2; g.stroke(P);
}

const FONT = (w, px) => `${w} ${px}px "PingFang SC", "Noto Sans SC", sans-serif`;
const INK = TYPE.titleLine, MEAS = TYPE.chrome[2], PAPER = mix(SNOW.near, BG.warm.wallNear, .35);
function text(g, str, x, y, px = 20, col = INK, w = 600, align = 'left') { g.fillStyle = col; g.font = FONT(w, px); g.textAlign = align; g.textBaseline = 'middle'; g.fillText(str, x, y); }
function dim(g, a, b, lab, off = [0, 0], col = MEAS) {   // 尺寸线：两端短横 + 标注
  const d = unit(a, b), n = nrm(d), t = 7;
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...b);
  for (const p of [a, b]) { g.moveTo(p[0] + n[0] * t, p[1] + n[1] * t); g.lineTo(p[0] - n[0] * t, p[1] - n[1] * t); }
  g.stroke();
  if (lab) text(g, lab, (a[0] + b[0]) / 2 + off[0], (a[1] + b[1]) / 2 + off[1], 17, col, 700, 'center');
}
function leader(g, p, q, lab, col = INK) {
  g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], 3.5, 0, 7); g.fill();
  text(g, lab, q[0] + (q[0] >= p[0] ? 6 : -6), q[1], 16, col, 600, q[0] >= p[0] ? 'left' : 'right');
}
function cross(g, x, y) { g.strokeStyle = TYPE.chrome[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke(); }
function cell(g, x, y, w, h, bg, lab, sub, fn) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = bg; g.fillRect(x, y, w, h); fn(); g.restore();
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.fillStyle = PAPER; g.fillRect(x + 3, y + 3, w - 6, 50);
  text(g, lab, x + 14, y + 20, 19, INK, 800); text(g, sub, x + 14, y + 42, 14, MEAS, 600);
}

// S5 样张（t 在 12–15 s）：就是合成的 s5 帧（scenes.js：背景板 → 逆光面片 → 面粉 → s5Hands），手在片中怎么接一眼看到
function s5Preview(g, e, t, A) {
  const SC = A?.mods?.scenes;
  if (!SC?.draw || !A?.plateS5) { text(g, 'S5 样张缺 scenes / plates 模块', 60, 80, 28, '#fff', 800); return {}; }
  return SC.draw({ t, g, e, ov: null, A, frame: 's5' });
}

export function test(g, e, t, AS) {
  if (t >= 12 && t < 15) return s5Preview(g, e, t, AS);
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  text(g, '老师傅的手 · 设定图', 24, 32, 30, INK, 800);
  text(g, '最后一碗面 · 80 年代赛璐璐：平涂 + 硬边阴影 / 高光 + 彩色描边，无渐变；手指成组的刚体形；hand(g, e, {x, y, s=掌宽, rot, side, pose, light})', 330, 34, 16, MEAS, 600);
  const hd = (o, stub) => { stub?.(); hand(g, e, { t, ...o }); cross(g, o.x, o.y); };

  // —— 比例（左上）——
  const S = 168, A = [222, 318], B = [545, 318];
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(1.5, 64, 757, 620);
  hand(g, e, { x: A[0], y: A[1], s: S, pose: 'flat', light: 'warm', arm: .12 });
  hand(g, e, { x: B[0], y: B[1], s: S, pose: 'open', light: 'warm', arm: .12 });
  text(g, '手背 · 右', 18, 86, 17); text(g, '掌心 · 右 · 三块老茧（长 × 掌宽）', 400, 86, 17);
  const ax = (x, y) => [A[0] + x * S, A[1] + y * S], bx = (x, y) => [B[0] + x * S, B[1] + y * S];
  dim(g, ax(-.5, .20), ax(.5, .20), '掌宽 1.0', [0, -14]);
  dim(g, ax(.64, -.50), ax(.64, .50)); text(g, '掌长 1.0', ...ax(.70, .05), 16, MEAS, 700); text(g, '1 : 1.0', ...ax(.70, .20), 15, MEAS, 700);
  dim(g, ax(.64, -.52), ax(.64, -1.20)); text(g, '中指 0.68', ...ax(.70, -.86), 16, MEAS, 700);
  dim(g, ax(-.23, -.84), ax(.01, -.84)); leader(g, ax(-.23, -.84), ax(-.70, -.86), '指宽 0.24', MEAS);
  dim(g, ax(-.25, -.56), ax(.03, -.56)); leader(g, ax(-.25, -.56), ax(-.70, -.62), `指节 +${Math.round((PROP.knuckle - 1) * 100)}%`, MEAS);
  leader(g, ax(-.36, -1.08), ax(-.70, -1.14), '指甲剪短');
  leader(g, ax(.42, 1.02), ax(.66, .80), '袖口发黄');
  leader(g, bx(.56, -.18), bx(.64, .40), '虎口 0.22');
  leader(g, bx(-.14, .36), bx(-.60, .62), '掌根 0.30');
  leader(g, bx(.46, -.56), bx(.62, -.92), '食指侧 0.12');
  // 片中实际大小（S1 / S13：掌宽 70 px，描边 2.5 px）+ 各镜头掌宽表
  g.save(); g.beginPath(); g.rect(560, 540, 190, 136); g.clip(); g.fillStyle = BG.dark.woodOut; g.fillRect(560, 540, 190, 136);
  beadStub(g, 620, 572, 70 * .125, 'out'); hand(g, e, { x: 620, y: 572, s: 70, pose: 'bead', light: 'out', arm: 2 });
  beadStub(g, 712, 572, 70 * .125, 'warm'); hand(g, e, { x: 712, y: 572, s: 70, pose: 'bead', light: 'warm', arm: 2 }); g.restore();
  g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(560, 540, 190, 136); g.fillStyle = PAPER; g.fillRect(561, 541, 188, 20); text(g, 'S1 原大 · 掌宽 70 px', 568, 551, 13, INK, 800);
  const tbl = [['S1/S13', '70', '2.5'], ['S2', '360', '1.6'], ['S3·S4', '300', '2.0'], ['S5 剪影', '280', '2.0'], ['S10', '250', '2.0'], ['S12', '200', '2.0']];
  text(g, '镜头 · 掌宽 px · 描边 px', 18, 556, 14, INK, 800);
  tbl.forEach(([a, b, c], i) => { const x = 18 + (i % 3) * 176, y = 582 + Math.floor(i / 3) * 24; text(g, `${a}  ${b} · ${c}`, x, y, 14, MEAS, 700); });
  text(g, '宽掌短粗指 · 指节大 · 老茧是硬边色块，落在阴影里换阴影色', 18, 664, 15, INK, 600);

  // —— 色票（左下）——
  const cols = ['皮', '皮影', '高光', '线', '茧', '茧影', '袖', '袖影', '袖线', '袖口', '口影', '轮廓光'];
  const rows = [['暖灯', 'warm'], ['灯灭·斑外', 'out'], ['灯灭·斑内', 'in'], ['剪影 S5', 's5'], ['剪影 S13', 's13']];
  const cx0 = 112, cw = 53, ry0 = 724;
  cols.forEach((c, i) => text(g, c, cx0 + i * cw + 20, 704, 13, INK, 700, 'center'));
  rows.forEach(([lab, L], r) => {
    const M = mats(L), y = ry0 + r * 70, sil = isSil(L);
    const v = sil ? [M.skin.f, null, null, M.skin.l, null, null, M.sleeve.f, null, null, null, null, M.rim]
      : [M.skin.f, M.skin.s, M.skin.h, M.skin.l, M.callus.f, M.callus.s, M.sleeve.f, M.sleeve.s, M.sleeve.l, M.cuff.f, M.cuff.s, M.rim];
    text(g, lab, 10, y + 20, 15, INK, 800);
    v.forEach((c, i) => {
      if (!c) return; const x = cx0 + i * cw;
      g.fillStyle = c; g.fillRect(x, y, 40, 34); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x, y, 40, 34);
      text(g, c.toUpperCase(), x + 20, y + 46, 10.5, INK, 600, 'center');
    });
  });

  // —— 手型（右）——
  const X0 = 772, CW = 287, CH = 500, Y0 = 70, Y1 = Y0 + CH + 8, warm = BG.warm.woodHalo;
  cell(g, X0, Y0, CW, CH, warm, 'bead 捏木珠', '右 · 暖灯 · 锚点=木珠心', () => {
    const o = { x: X0 + 150, y: Y0 + 190, s: 150, pose: 'bead', light: 'warm', side: 'R' };
    hd(o, () => beadStub(g, o.x, o.y, o.s * .125, 'warm'));
  });
  cell(g, X0 + CW, Y0, CW, CH, warm, 'grip 握擀面杖', '右 · 暖灯 · 锚点=杖轴', () => {
    const o = { x: X0 + CW + 160, y: Y0 + 220, s: 150, pose: 'grip', light: 'warm', side: 'R' };
    hd(o, () => pinStub(g, X0 + CW - 10, X0 + 2 * CW + 10, o.y, o.s * .2, 'warm'));
  });
  cell(g, X0 + 2 * CW, Y0, CW, CH, warm, 'press 压面窝', '右 · 暖灯 · 锚点=指尖', () => {
    const o = { x: X0 + 2 * CW + 150, y: Y0 + 170, s: 150, pose: 'press', light: 'warm', side: 'R' };
    hd(o, () => doughStub(g, o.x, o.y, o.s * .9)); doughStub(g, o.x, o.y, o.s * .9, true); cross(g, o.x, o.y);
  });
  cell(g, X0 + 3 * CW, Y0, CW, CH, warm, 'flat 掌放平', '左 · 暖灯 · 锚点=掌心', () => {
    hd({ x: X0 + 3 * CW + 140, y: Y0 + 250, s: 150, pose: 'flat', light: 'warm', side: 'L' });
  });
  cell(g, X0, Y1, CW * 2, CH, BG.warm.wallFar, 'lift 托杖举起 · 剪影 S5 仰拍', '握在杖两端、面片外侧 · 指节高低错开 · 拇指压杖 · 前臂前缩 + 袖卷 · 3 px 暖金轮廓光 · 锚点=杖轴', () => {
    const cx = X0 + CW, top = Y1 + 118, P = AS?.mods?.props, o = { grips: [[cx - 192, top], [cx + 192, top]], cx, s: 118, t };
    if (P?.doughBacklit) P.doughBacklit(g, e, { t, cx, top, r: 12, w: 262, h: 150, over: 650, lamp: [cx - 10, top + 45] });
    else { g.fillStyle = CORE_; g.beginPath(); g.arc(cx, top + 80, 120, 0, 7); g.fill(); pinStub(g, X0 - 20, X0 + 2 * CW + 20, top, 12, 's5'); }
    s5Hands(g, e, o); o.grips.forEach(([x, y]) => cross(g, x, y));
  });
  cell(g, X0 + 2 * CW, Y1, CW, CH, BG.dark.woodOut, 'bead · 灯灭', '右 · 斑外 · 雪青灰轮廓光 2 px，固定朝窗 ↗', () => {
    const o = { x: X0 + 2 * CW + 140, y: Y1 + 170, s: 130, pose: 'bead', light: 'out', side: 'R' };
    hd(o, () => beadStub(g, o.x, o.y, o.s * .125, 'out'));
    const ix = X0 + 2 * CW + 130, iy = Y1 + 318;
    g.fillStyle = BG.dark.woodIn; g.fillRect(ix, iy, CW - 130, CH - 318); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(ix, iy, CW - 130, CH - 318);
    hd({ x: ix + 80, y: iy + 110, s: 82, pose: 'flat', light: 'in', side: 'R', arm: .3 });
    g.fillStyle = PAPER; g.fillRect(ix + 2, iy + 2, CW - 134, 22); text(g, '斑内（备用）', ix + 8, iy + 13, 13, INK, 700);
  });
  cell(g, X0 + 3 * CW, Y1, CW, CH, BG.night.indigo, 'grip · 剪影 S13', '右 · 窗外扣住卷帘底杠 · 路灯金边', () => {
    const o = { x: X0 + 3 * CW + 150, y: Y1 + 210, s: 130, pose: 'grip', light: 's13', side: 'R' };
    hd(o, () => pinStub(g, X0 + 3 * CW - 10, X0 + 4 * CW + 10, o.y, 14, 's13'));
  });
  return {};
}

// —— 镜头自己摆手型（2026-11-05 粗剪第 2 轮）——
// hand(g, e, { pose: o => ({ arm: { w: [x, y], a: 度 }, parts: [...], off?: [x, y] }), ... })：pose 也可以是函数，返回值和上面 POSE 里各手型一样。
// 用这些积木搭（单位：掌宽 = 1，锚点在原点，rot = 0 时前臂从下方 +y 伸进来），画法、色指定、描边、轮廓光和设定图完全一致：
//   part('skin', [[x, y, 尖角?], ...], {sh, hi, cal, ln})  掌面 / 手背外形；首项写 'W' 表示这块是手掌（前臂接在它上面）
//   digit(指根 [x, y], [各节角度°…], [各节长…], {w, nail, back, palm, cal, id})  一根手指（拇指也用它）；角度 0° 朝右、90° 朝下
//   four(四个指根 [[x, y]×4，食→小], [四根的根节角度°], [三节各自的长度系数], {back, palm, nail, cal, kf, id})  四指一起
//   backOfHand(掌面 part, 四个掌指骨节点, 腕点, seed)  手背的筋和骨节；knuckle(...) 收起的指节；FW 指宽，FWK 各指粗细系数
// 摆手型先想清楚这个动作里每根手指各在干什么（压、扣、捏、托、搭、张开），关节只往掌心一侧弯，四指不要一样的角度。
export { digit, four, part, backOfHand, knuckle, FW, FWK };
