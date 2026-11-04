// film.js —— 整片时间线：skeleton.json 的「小节:拍」→ 秒，按 t 找镜头并调用它的画法；字幕画在 ov 层（在 CRT pass 里合成）。
// S1 / S5 / S13 用 scenes.js 的主构图与招牌镜头；其余镜头各在 shots/<id>.js，导出 draw(g, e, lt, A, t) → CRT 覆盖参数（lt = 镜头内秒数）。
// 镜头模块缺失或报错时画占位卡，整片照样能出。页面加 ?shot=S4 只看一个镜头（t 仍是全片时间）。
import { W, H } from './lib/cel.js';

const SPB = 60 / 80, BAR = 4 * SPB;                        // 80 bpm、4/4：一拍 0.75 s，一小节 3 s
export const sec = s => { const [b, k] = String(s).split(':').map(Number); return (b - 1) * BAR + (k - 1) * SPB; };
const MAIN = { S1: 'a', S5: 's5', S13: 'a2' };            // 用 scenes.js 画的镜头
const SUB = { font: '700 52px "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif', fill: '#FFF0B8', line: '#2A1A24', base: H - 96 };
let SK = null;
const MOD = {};

export async function load() {
  SK = await (await fetch(new URL('./skeleton.json', import.meta.url))).json();
  for (const x of [...SK.shots, ...SK.subs]) { x.t0 = sec(x.start); x.t1 = sec(x.end); }
  for (const s of SK.shots) {
    if (MAIN[s.id]) continue;
    try { MOD[s.id] = await import(`./shots/${s.id.toLowerCase()}.js`); }
    catch (err) { MOD[s.id] = { err: String(err?.message || err) }; }
  }
  return SK;
}

export const shotAt = t => SK.shots.find(s => t >= s.t0 && t < s.t1) || SK.shots[SK.shots.length - 1];

function placeholder(g, e, s, msg) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  g.fillStyle = '#26223a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c9c3dc'; g.textAlign = 'center';
  g.font = '700 64px "PingFang SC", sans-serif'; g.fillText(`${s.id} · ${s.framing}`, W / 2, H / 2 - 20);
  g.font = '400 30px "PingFang SC", sans-serif'; g.fillText(msg, W / 2, H / 2 + 50);
}

function subtitles(ov, t) {
  const m = SK.subs.find(x => t >= x.t0 && t < x.t1);
  if (!m) return;
  ov.save();
  ov.font = SUB.font; ov.textAlign = 'center'; ov.textBaseline = 'alphabetic'; ov.lineJoin = 'round';
  ov.shadowColor = 'rgba(12, 6, 18, .55)'; ov.shadowBlur = 12; ov.shadowOffsetY = 3;
  ov.strokeStyle = SUB.line; ov.lineWidth = 10; ov.strokeText(m.text, W / 2, SUB.base);   // 描边居中画，10 = 外侧 5 px
  ov.shadowColor = 'transparent'; ov.fillStyle = SUB.fill; ov.fillText(m.text, W / 2, SUB.base);
  ov.restore();
}

export function draw({ t, g, e, ov, A, shot }) {
  const s = (shot && SK.shots.find(x => x.id === shot)) || shotAt(t);
  let over = {};
  if (MAIN[s.id]) over = A.mods.scenes.draw({ t, g, e, ov, A, frame: MAIN[s.id] }) || {};
  else {
    const m = MOD[s.id];
    if (m?.draw) {
      try { over = m.draw(g, e, t - s.t0, A, t) || {}; }
      catch (err) { placeholder(g, e, s, `报错：${err?.message || err}`); }
    } else placeholder(g, e, s, m?.err ? `模块载入失败：${m.err}` : '还没画');
  }
  subtitles(ov, t);
  return over;
}
