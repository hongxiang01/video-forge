// title.js —— 片名（TREATMENT §8.3、§4.1 片名区）：S13 40.5–45.0，卷帘门落定后的窗洞里；由 scenes.js frameA2 在 t ≥ 40.5 时调用。
// 主标题「最后一碗面」：粗黑体（粗剪临时字体：PingFang SC 600 / Hiragino Sans GB W6，再用同色描边加粗），整体水平错切 −12° 成斜体，
//   140 px，字距 8 px，居中 x 960、基线 y 382；铬金渐变（天蓝 0–42% → 白地平线 42–46% 硬线 → 紫 → 粉 → 金），
//   内描边深靛 6 px + 外圈琥珀霓虹 2 px；发光画进 e（霓虹圈 + 字面，深靛内描边处印黑，不发光）。
// 副行 THE LAST BOWL：Avenir Next Heavy Italic 56 px，字距 12 px，中心 y 190；奶黄平涂 + 深靛描边 4 px；60% 强度进 e，不扫光、不闪星。
// 节奏：主标题 40.5–40.75 按 12 fps「亮、灭、亮」（各 2 帧），40.75 全亮；副行 41.0–41.25 同样；
//   41.25–41.75 一道扫光从左到右（source-atop，只扫主标题）；41.75「面」字右上角一个星芒。
// 绘制确定：不用随机数 / 时钟。
import { canvas, mix, rgba, W, H } from './lib/cel.js';
import { TYPE } from './pal.js';

const EPS = 1e-6;
const SHEAR = Math.tan(-12 * Math.PI / 180);   // x' = x + SHEAR·(y − 基线)：基线不动，字顶往右倒
const M = { text: '最后一碗面', track: 8, cx: 960, base: 382, bold: 3, inner: 6, neon: 2,
  font: '600 140px "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif' };
const S = { text: 'THE LAST BOWL', track: 12, cx: 960, cy: 190, line: 4,
  font: 'italic 800 56px "Avenir Next", "Avenir", "Helvetica Neue", sans-serif' };
const T = { main: 40.5, sub: 41.0, sweep: [41.25, 41.75], star: [41.75, 42.25] };

// 12 fps 闪亮：从 t0 起「亮、灭、亮」各 2 帧（1/12 s），之后常亮；返回 0 / 1
const flash = (t, t0) => t < t0 - EPS ? 0 : Math.floor((t - t0) * 12 + EPS) === 1 ? 0 : 1;
export const titleLevel = t => flash(t, T.main);   // 合成用：主标题此刻亮不亮（门板被片名微微照亮）

// 逐字排（字距手排）：返回 [[字, x, 字宽]…]，整行以 cx 居中
function row(x, text, track, cx) {
  const cs = [...text], ws = cs.map(ch => x.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + track * (cs.length - 1);
  let at = cx - tot / 2;
  return cs.map((ch, i) => { const r = [ch, at, ws[i]]; at += ws[i] + track; return r; });
}

// 主标题画进离屏两张（颜色 / 发光），扫光用 source-atop 只落在字上
let MC = null, ME = null;
function paintMain(t) {
  MC = MC || canvas(W, H); ME = ME || canvas(W, H);
  const [, x] = MC, [, ex] = ME;
  for (const c of [x, ex]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, H); }
  x.font = ex.font = M.font; x.textBaseline = ex.textBaseline = 'alphabetic'; x.textAlign = ex.textAlign = 'left'; x.lineJoin = ex.lineJoin = 'round';
  const m = x.measureText(M.text), top = M.base - m.actualBoundingBoxAscent, bot = M.base + m.actualBoundingBoxDescent;
  const cx = M.cx - SHEAR * ((top + bot) / 2 - M.base);   // 错切后字块视觉中心回到 x 960
  const cs = row(x, M.text, M.track, cx);
  const sheared = c => c.setTransform(1, 0, SHEAR, 1, -SHEAR * M.base, 0);
  const pass = (c, w, col) => { c.lineWidth = w; c.strokeStyle = col; for (const [ch, at] of cs) c.strokeText(ch, at, M.base); };
  const chrome = c => {   // 铬金：按字高从上到下，白地平线是一条硬线
    const [sky, white, purple, pink, gold] = TYPE.chrome, gr = c.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, mix(sky, '#3F7FD8', .3)); gr.addColorStop(.42, mix(sky, white, .3)); gr.addColorStop(.42, white); gr.addColorStop(.46, white);
    gr.addColorStop(.46, purple); gr.addColorStop(.74, pink); gr.addColorStop(1, gold);
    return gr;
  };
  // 颜色层：琥珀霓虹（最外 2 px）→ 深靛内描边 6 px → 铬金字面（同色描边加粗 bold px）
  sheared(x);
  pass(x, 2 * (M.bold + M.inner + M.neon), TYPE.neon);
  pass(x, 2 * (M.bold + M.inner), TYPE.titleLine);
  const gr = chrome(x); pass(x, 2 * M.bold, gr); x.fillStyle = gr; for (const [ch, at] of cs) x.fillText(ch, at, M.base);
  // 发光层：霓虹圈放宽一点给 bloom 吃，深靛那圈印黑，字面 32%
  sheared(ex);
  pass(ex, 2 * (M.bold + M.inner + M.neon) + 10, rgba(TYPE.neon, .8));
  pass(ex, 2 * (M.bold + M.inner), '#000');
  ex.globalAlpha = .32; const ge = chrome(ex);   // 字面进发光板收在 1/3：再高铬金会被 bloom 冲成一片白 pass(ex, 2 * M.bold, ge); ex.fillStyle = ge; for (const [ch, at] of cs) ex.fillText(ch, at, M.base); ex.globalAlpha = 1;
  // 扫光（41.25–41.75，从左到右一次）：两条斜的硬边亮带，source-atop 只落在已画的字上
  const u = (t - T.sweep[0]) / (T.sweep[1] - T.sweep[0]);
  if (u >= 0 && u < 1) {
    const last = cs[cs.length - 1], x0 = cs[0][1] - 60, x1 = last[1] + last[2] + 90, e = u * u * (3 - 2 * u), bx = x0 + (x1 - x0) * e, k = (bot - top) * .35;
    const band = (c, at, w, col) => {
      c.fillStyle = col; c.beginPath();
      c.moveTo(at - w / 2 + k, top - 12); c.lineTo(at + w / 2 + k, top - 12); c.lineTo(at + w / 2 - k, bot + 12); c.lineTo(at - w / 2 - k, bot + 12); c.closePath(); c.fill();
    };
    for (const [c, a] of [[x, 1], [ex, .9]]) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
      band(c, bx, 38, rgba('#FFFFFF', .92 * a)); band(c, bx - 40, 12, rgba('#FFFFFF', .75 * a));
      c.globalCompositeOperation = 'source-over';
    }
  }
  x.setTransform(1, 0, 0, 1, 0, 0); ex.setTransform(1, 0, 0, 1, 0, 0);
  // 星芒锚点：「面」字框右上角（错切后的位置），往字里收一点
  const [, at, w] = cs[cs.length - 1], sy = top + 16;
  return { star: [at + w - 10 + SHEAR * (sy - M.base), sy] };
}

// 星芒：横长竖短的四芒 + 一组短斜芒；颜色层白芯，发光层暖白
function star(g, e, x, y, s) {
  const shape = (L, Lv, r, d) => {
    const p = new Path2D(), pts = [[L, 0], [r, r], [0, Lv], [-r, r], [-L, 0], [-r, -r], [0, -Lv], [r, -r]];
    pts.forEach(([a, b], i) => i ? p.lineTo(x + a, y + b) : p.moveTo(x + a, y + b)); p.closePath();
    const q = [[d, d], [r * .5, 0], [-d, d], [0, r * .5], [-d, -d], [-r * .5, 0], [d, -d], [0, -r * .5]];   // 斜芒（45°）
    q.forEach(([a, b], i) => i ? p.lineTo(x + a, y + b) : p.moveTo(x + a, y + b)); p.closePath();
    return p;
  };
  e.fillStyle = '#FFF0C8'; e.fill(shape(120 * s, 78 * s, 7 * s, 26 * s));
  g.fillStyle = '#FFFFFF'; g.fill(shape(100 * s, 64 * s, 4.5 * s, 20 * s));
  g.beginPath(); g.arc(x, y, 6 * s, 0, Math.PI * 2); g.fill();
}

function paintSub(g, e) {
  for (const [c, glow] of [[g, false], [e, true]]) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = S.font; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
    const m = c.measureText(S.text), base = S.cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;   // 大写字母块的中心落在 y 190
    const cs = row(c, S.text, S.track, S.cx);
    if (glow) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .6; }
    else { c.lineWidth = 2 * S.line; c.strokeStyle = TYPE.titleLine; for (const [ch, at] of cs) c.strokeText(ch, at, base); }
    c.fillStyle = TYPE.sub; for (const [ch, at] of cs) c.fillText(ch, at, base);
    c.restore();
  }
}

export function drawTitle(g, e, ov, t) {
  if (titleLevel(t)) {
    const R = paintMain(t);
    g.drawImage(MC[0], 0, 0);
    e.save(); e.setTransform(1, 0, 0, 1, 0, 0); e.globalCompositeOperation = 'lighter'; e.drawImage(ME[0], 0, 0); e.restore();
    const u = (t - T.star[0]) / (T.star[1] - T.star[0]);
    if (u >= 0 && u < 1) star(g, e, ...R.star, u < .3 ? u / .3 : 1 - (u - .3) / .7);   // 快起慢收
  }
  if (flash(t, T.sub)) paintSub(g, e);
}
