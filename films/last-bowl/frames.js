// 画面调度（后期 / 合成负责人的文件）。load() 加载时画一次背景板；draw() 每帧调用。
// 各模块用动态 import 载入：模块还没写好时页面照样能跑，测试页显示「缺模块」。
import { W, H } from './lib/cel.js';

// 覆盖 lib/post.js 的默认参数（合成负责人调）。
// 暗角：post.js 角上衰减 = corner × 2.5；默认 .28 → 角上压掉 70%（比向内 120 px 处暗约一半）。画风要克制。
// 第 3 轮（评委：角落比内侧暗约 50%）：.07 → .045，暗角本身只压 11%；加上扫描线、S 曲线对暗部多压的几个百分点，
// 实测 CRT 版和 raw 版相比，角上只比画面中心多暗约 15%（a、a2 都量过）。角上剩下的暗是背景板自己画的（plates.js）
export const POST = { corner: .045 };
const MODS = ['plates', 'hands', 'props', 'fx', 'scenes', 'hand3d'];

export async function load() {
  const A = { mods: {} };
  for (const m of MODS) {
    try { A.mods[m] = await import(`./${m}.js`); } catch (err) { A.mods[m] = null; A.missing = (A.missing || []).concat(`${m}: ${err.message}`); }
  }
  if (A.mods.plates?.load) Object.assign(A, await A.mods.plates.load());
  if (A.mods.props?.load) Object.assign(A, await A.mods.props.load());
  // 整片时间线（film.js）：没给 ?frame 时按 t 排镜头；载入失败就退回 scenes.js 的三张主画面
  try { A.film = await import('./film.js'); await A.film.load(); } catch (err) { A.film = null; A.missing = (A.missing || []).concat(`film: ${err.message}`); }
  return A;
}
const SHOT = new URLSearchParams(location.search).get('shot');

// 风格帧（合成负责人实现）：名字 → 片中时间
export const FRAMES = { s5: 13.8, a: 2.0, a2: 37.8 };

export function draw({ t, g, e, ov, A, frame, test }) {
  if (test) {
    const m = A.mods[test];
    if (m?.test) return m.test(g, e, t, A) || {};
    g.fillStyle = '#3a3448'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.font = '32px sans-serif'; g.fillText(`缺模块或缺 test()：${test}　${(A.missing || []).join('；')}`, 60, 80);
    return { scan: 0, bleed: 1, glow: 0 };
  }
  if (!frame && A.film && A.mods.scenes?.draw) return A.film.draw({ t, g, e, ov, A, shot: SHOT });
  if (A.mods.scenes?.draw) return A.mods.scenes.draw({ t, g, e, ov, A, frame });
  g.fillStyle = '#20223a'; g.fillRect(0, 0, W, H);
  return {};
}
