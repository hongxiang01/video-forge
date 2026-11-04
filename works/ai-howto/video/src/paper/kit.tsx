// 纸本风格图元库（《AI 到底该怎么用》）。所有镜头只从这里取颜色与图元，保证全片统一。
// 坐标系：1920×1080。帧号：useCurrentFrame() 返回的是**全片绝对帧**（0 起），时间轴 SENTENCES 的 from/to 是 1 起，
// 统一用 at('S03') / blk('S03', 1) 拿到 0 起的绝对帧，直接和 f 比较。
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SENTENCES} from '../common/timeline';
import {SUBS} from '../common/subs';
import {FONT_HEAVY} from '../common/lib';

// ───────── 色板（风格卡：纸本） ─────────
export const P = {
  bg: '#F2ECE0', // 纸底
  soft: '#E4D9C4', // 大面积次要色块
  mid: '#9A8F7E', // 远景 / 次要线
  ink: '#1F1B16', // 主线 / 文字
  accent: '#E2552B', // 唯一强调色（橙红）
  ok: '#1F1B16', // 通过勾 = 墨色（评审 v1：绿色成了第二强调色，改为只留橙红）
  white: '#FBF8F1',
};
export const FONT = FONT_HEAVY;
export const W = 1920;
export const H = 1080;

// ───────── 时间 ─────────
export const useF = () => useCurrentFrame();
const SMAP = Object.fromEntries(SENTENCES.map((s) => [s.id, s]));
/** 句子起止（0 起绝对帧） */
export const at = (id: string) => {
  const s = SMAP[id];
  if (!s) throw new Error('no sentence ' + id);
  return {from: s.from - 1, to: s.to - 1};
};
/** 句子 id 的第 k 个字幕块（0 起）起始帧——用于让元素卡在某个短语上 */
export const blk = (id: string, k: number) => {
  const s = SMAP[id];
  const subs = SUBS.filter((b) => b.from >= s.from && b.to <= s.to + 1);
  const b = subs[Math.min(k, subs.length - 1)];
  return b.from - 1;
};

// ───────── 缓动 ─────────
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** 从 start 帧开始、dur 帧内 0→1（easeOut） */
export const prog = (f: number, start: number, dur = 15, ease = easeOut) => ease((f - start) / dur);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 入场：淡入 + 上移 24px */
export const rise = (f: number, start: number, dur = 14): React.CSSProperties => {
  const p = prog(f, start, dur);
  return {opacity: p, transform: `translateY(${(1 - p) * 24}px)`};
};

// ───────── 舞台 ─────────
/** 极缓推近相机：包住整个镜头内容，在 [from,to] 内 1.0→scale */
export const Cam: React.FC<{from: number; to: number; scale?: number; ox?: number; oy?: number; dx?: number; children: React.ReactNode}> = ({from, to, scale = 1.05, ox = 960, oy = 540, dx = 0, children}) => {
  const f = useF();
  const t = easeInOut((f - from) / Math.max(1, to - from));
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${-dx * t}px) scale(${lerp(1, scale, t)})`, transformOrigin: `${ox}px ${oy}px`}}>
      {children}
    </div>
  );
};

/** 全屏 SVG 画布（子元素用 SVG 图元） */
export const Svg: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, overflow: 'visible', ...style}}>
    {children}
  </svg>
);

/** 地面 + 远景窗格（工厂场景的底） */
export const Floor: React.FC<{y?: number; windows?: boolean}> = ({y = 900, windows = true}) => (
  <g>
    {windows
      ? Array.from({length: 6}).map((_, i) => (
          <g key={i} opacity={0.55}>
            <rect x={140 + i * 290} y={200} width={220} height={130} fill="none" stroke={P.mid} strokeWidth={3} />
            <line x1={250 + i * 290} y1={200} x2={250 + i * 290} y2={330} stroke={P.mid} strokeWidth={2} />
          </g>
        ))
      : null}
    <rect x={-200} y={y} width={W + 400} height={H - y + 200} fill={P.soft} />
    <line x1={-200} y1={y} x2={W + 200} y2={y} stroke={P.ink} strokeWidth={4} />
  </g>
);

/** 传送带：x0..x1，顶面 y；phase 为滚动相位（传 f 即持续滚动） */
export const Belt: React.FC<{x0?: number; x1?: number; y?: number; floor?: number; phase?: number}> = ({x0 = 60, x1 = 1560, y = 700, floor = 900, phase = 0}) => {
  const len = x1 - x0;
  const off = (phase * 2) % 60;
  return (
    <g>
      <rect x={x0} y={y} width={len} height={44} rx={22} fill={P.soft} stroke={P.ink} strokeWidth={4} />
      {Array.from({length: Math.ceil(len / 60)}).map((_, i) => {
        const x = x0 + 20 + ((i * 60 + off) % (len - 20));
        if (x > x1 - 25) return null;
        return <line key={i} x1={x} y1={y + 6} x2={x} y2={y + 38} stroke={P.mid} strokeWidth={3} />;
      })}
      {Array.from({length: Math.floor(len / 135)}).map((_, i) => (
        <line key={'l' + i} x1={x0 + 90 + i * 135} y1={y + 44} x2={x0 + 90 + i * 135} y2={floor} stroke={P.ink} strokeWidth={4} />
      ))}
    </g>
  );
};

/** 钟（方盒 + 表盘）。h/m 指时间；hot=指针用强调色；box=false 只画表盘 */
export const Clock: React.FC<{cx: number; cy: number; r?: number; h: number; m: number; hot?: boolean; box?: boolean; opacity?: number}> = ({cx, cy, r = 52, h, m, hot, box = true, opacity = 1}) => {
  const mA = (m / 60) * 360;
  const hA = ((h % 12) / 12) * 360 + (m / 60) * 30;
  const hand = (a: number, len: number, w: number, c: string) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return <line x1={cx} y1={cy} x2={cx + Math.cos(rad) * len} y2={cy + Math.sin(rad) * len} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  };
  const k = r / 52;
  return (
    <g opacity={opacity}>
      {box ? <rect x={cx - r - 14 * k} y={cy - r - 14 * k} width={(r + 14 * k) * 2} height={(r + 14 * k) * 2} rx={10 * k} fill={P.soft} stroke={P.ink} strokeWidth={4} /> : null}
      <circle cx={cx} cy={cy} r={r} fill={P.bg} stroke={P.ink} strokeWidth={4} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = r - (i % 3 === 0 ? 13 : 8) * k;
        return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * (r - 3)} y2={cy + Math.sin(a) * (r - 3)} stroke={P.ink} strokeWidth={i % 3 === 0 ? 4 : 2} />;
      })}
      {hand(hA, r * 0.5, 7 * Math.max(0.6, k), hot ? P.accent : P.ink)}
      {hand(mA, r * 0.78, 5 * Math.max(0.6, k), hot ? P.accent : P.ink)}
      <circle cx={cx} cy={cy} r={6 * Math.max(0.6, k)} fill={P.ink} />
    </g>
  );
};

/** 吊轨机械臂（代表 AI）。base 小车在 (bx, railY)；夹爪末端在 (tx, ty)。用两段连杆 IK 自动摆姿态。 */
export const Arm: React.FC<{bx: number; tx: number; ty: number; railY?: number; rail?: boolean; railX0?: number; railX1?: number; open?: number}> = ({bx, tx, ty, railY = 120, rail = true, railX0 = 80, railX1 = 1320, open = 0}) => {
  const sx = bx;
  const sy = railY + 36;
  const L1 = 190;
  const L2 = 160;
  const dx = tx - sx;
  const dy = ty - 30 - sy;
  const d = Math.min(L1 + L2 - 1, Math.max(Math.abs(L1 - L2) + 1, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx);
  const b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const ex = sx + Math.cos(a - b) * L1; // 肘部向一侧弯
  const ey = sy + Math.sin(a - b) * L1;
  const wx = sx + Math.cos(a) * d;
  const wy = sy + Math.sin(a) * d;
  const g = 30 + open * 18;
  return (
    <g>
      {rail ? (
        <g>
          <rect x={railX0} y={railY} width={railX1 - railX0} height={26} fill={P.soft} stroke={P.ink} strokeWidth={4} />
          {Array.from({length: Math.floor((railX1 - railX0) / 170) + 1}).map((_, i) => (
            <line key={i} x1={railX0 + 40 + i * 170} y1={railY - 60} x2={railX0 + 40 + i * 170} y2={railY} stroke={P.ink} strokeWidth={4} />
          ))}
        </g>
      ) : null}
      <rect x={sx - 70} y={railY - 10} width={140} height={46} rx={8} fill={P.ink} />
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={P.ink} strokeWidth={26} strokeLinecap="round" />
      <circle cx={ex} cy={ey} r={22} fill={P.bg} stroke={P.ink} strokeWidth={6} />
      <line x1={ex} y1={ey} x2={wx} y2={wy} stroke={P.ink} strokeWidth={20} strokeLinecap="round" />
      <circle cx={wx} cy={wy} r={16} fill={P.bg} stroke={P.ink} strokeWidth={6} />
      <path d={`M ${wx - g} ${wy + 20} L ${wx - g} ${wy + 50} M ${wx + g} ${wy + 20} L ${wx + g} ${wy + 50} M ${wx - g} ${wy + 20} L ${wx + g} ${wy + 20}`} stroke={P.ink} strokeWidth={10} fill="none" strokeLinecap="round" />
    </g>
  );
};

/** 人物剪影（远、小、静止；人物不演戏）。x=脚中心，floor=脚底 y，s=缩放。board=拿验收板 */
export const Person: React.FC<{x: number; floor: number; s?: number; board?: boolean; check?: boolean; color?: string; opacity?: number}> = ({x, floor, s = 1, board = true, check = true, color = P.ink, opacity = 1}) => (
  <g transform={`translate(${x} ${floor}) scale(${s})`} fill={color} opacity={opacity}>
    <circle cx={0} cy={-232} r={26} />
    <path d="M -40 -196 Q 0 -214 40 -196 L 34 -92 L -34 -92 Z" />
    <rect x={-30} y={-96} width={24} height={96} rx={8} />
    <rect x={6} y={-96} width={24} height={96} rx={8} />
    {board ? (
      <g transform="rotate(-12 -59 -148)">
        <rect x={-82} y={-178} width={46} height={60} rx={4} fill={P.bg} stroke={color} strokeWidth={4} />
        {check ? <path d="M -70 -150 l 9 9 l 16 -20" stroke={P.accent} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </g>
    ) : null}
  </g>
);

/** 检测门（防错）。x=左柱 x，y=门顶 y，floorY=柱底。beam=光束亮度 0..1；hazard=警示斜纹（全片只在防错工位用） */
export const Gate: React.FC<{x: number; y?: number; bottom?: number; w?: number; beam?: number; hazard?: boolean; lamp?: string}> = ({x, y = 500, bottom = 700, w = 200, beam = 1, hazard = false, lamp = P.accent}) => (
  <g>
    <rect x={x + 10} y={y + 20} width={30} height={bottom - y - 20} fill={P.ink} />
    <rect x={x + w - 20} y={y + 20} width={30} height={bottom - y - 20} fill={P.ink} />
    <rect x={x} y={y} width={w + 20} height={30} fill={hazard ? P.accent : P.ink} stroke={P.ink} strokeWidth={4} />
    {hazard ? Array.from({length: Math.floor(w / 28)}).map((_, i) => <path key={i} d={`M ${x + 6 + i * 28} ${y + 28} l 14 -26 l 10 0 l -14 26 Z`} fill={P.ink} />) : null}
    <line x1={x + 40} y1={y + 120} x2={x + w - 20} y2={y + 120} stroke={P.accent} strokeWidth={5} strokeDasharray="14 10" opacity={beam} />
    <circle cx={x + w + 5} cy={y + 10} r={9} fill={lamp} />
  </g>
);

/** 卡片（工单 / 引文卡 / 来源卡）。HTML 层，适合放文字。 */
export const Card: React.FC<{x: number; y: number; w: number; h?: number; title?: string; children?: React.ReactNode; style?: React.CSSProperties; rot?: number}> = ({x, y, w, h, title, children, style, rot = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, background: P.white, border: `4px solid ${P.ink}`, borderRadius: 10, boxShadow: `8px 8px 0 ${P.soft}`, padding: '22px 28px', boxSizing: 'border-box', fontFamily: FONT, color: P.ink, transform: `rotate(${rot}deg)`, ...style}}>
    {title ? <div style={{fontSize: 30, fontWeight: 800, marginBottom: 14, letterSpacing: 1}}>{title}</div> : null}
    {children}
  </div>
);

/** 纯文字（HTML 层）。size 默认 46 */
export const Txt: React.FC<{x: number; y: number; size?: number; weight?: number; color?: string; children: React.ReactNode; style?: React.CSSProperties; center?: boolean}> = ({x, y, size = 46, weight = 800, color = P.ink, children, style, center}) => (
  <div style={{position: 'absolute', left: x, top: y, fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.15, whiteSpace: 'nowrap', transform: center ? 'translateX(-50%)' : undefined, fontVariantNumeric: 'tabular-nums', ...style}}>
    {children}
  </div>
);

// ───────── 强调（talkcraft 动效） ─────────
/** 手绘歪椭圆路径（一笔逆时针 1.08 圈） */
export const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: string[] = [];
  const N = 90;
  const tilt = (-3.5 * Math.PI) / 180;
  for (let i = 0; i <= N; i++) {
    const t = Math.PI * 0.85 - (i / N) * Math.PI * 2 * 1.08;
    const wob = 1 + 0.035 * Math.sin(3 * t + 0.7) + 0.02 * Math.sin(5 * t);
    const x0 = Math.cos(t) * rx * wob;
    const y0 = Math.sin(t) * ry * wob;
    pts.push(`${i === 0 ? 'M' : 'L'} ${(cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt)).toFixed(1)} ${(cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt)).toFixed(1)}`);
  }
  return pts.join(' ');
};

/**
 * 关键词（画面上唯一允许的大字）。center 定位。start=入场帧；circle=画完后 0.5s 手绘圈 + punch。
 * 一个镜头最多 1 个带圈关键词。
 */
export const Keyword: React.FC<{text: string; cx: number; cy: number; start: number; size?: number; circle?: boolean; color?: string; circleAt?: number}> = ({text, cx, cy, start, size = 96, circle = true, color = P.ink, circleAt}) => {
  const f = useF();
  const p = prog(f, start, 12);
  const c0 = circleAt ?? start + 14;
  const draw = prog(f, c0, 15);
  const punch = circle && f > c0 + 16 ? 1 + 0.06 * (1 - easeOut((f - c0 - 16) / 7)) : 1;
  const wEst = [...text].reduce((s, ch) => s + (/[\x00-\x7F]/.test(ch) ? 0.58 : 1), 0) * size;
  const L = 2 * Math.PI * Math.sqrt(((wEst / 2 + 40 + size * 0.45) ** 2 + (size * 0.9) ** 2) / 2) * 1.12;
  return (
    <>
      <div style={{position: 'absolute', left: cx, top: cy, transform: `translate(-50%,-50%) translateY(${(1 - p) * 20}px) scale(${punch})`, opacity: p, fontFamily: FONT, fontWeight: 900, fontSize: size, color, letterSpacing: -1, lineHeight: 1, whiteSpace: 'nowrap'}}>{text}</div>
      {circle ? (
        <Svg>
          <path d={ellipsePath(cx, cy, wEst / 2 + 40 + size * 0.45, size * 0.9)} fill="none" stroke={P.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - draw)} />
        </Svg>
      ) : null}
    </>
  );
};

/** 标注引出线（圆点 pop + 涟漪 → 折线生长 → 标签）。(x,y) 目标点；(ex,ey) 折点；len 水平段长度；label 在水平段上方 */
export const Callout: React.FC<{x: number; y: number; ex: number; ey: number; len?: number; label: string; start: number; size?: number; left?: boolean}> = ({x, y, ex, ey, len = 160, label, start, size = 44, left = false}) => {
  const f = useF();
  const dot = prog(f, start, 6);
  const line = prog(f, start + 6, 12);
  const lab = prog(f, start + 16, 8);
  const hx = left ? ex - len : ex + len;
  const L = Math.hypot(ex - x, ey - y) + len;
  return (
    <>
      <Svg>
        <circle cx={x} cy={y} r={10 + 30 * dot} fill="none" stroke={P.accent} strokeWidth={3} opacity={(1 - dot) * (dot > 0 ? 1 : 0)} />
        <circle cx={x} cy={y} r={8 * dot} fill={P.accent} />
        <path d={`M ${x} ${y} L ${ex} ${ey} L ${hx} ${ey}`} stroke={P.accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - line)} />
      </Svg>
      <Txt x={left ? hx : ex + 4} y={ey - size - 14} size={size} style={{opacity: lab, transform: `translateY(${(1 - lab) * 10}px)`}}>
        {label}
      </Txt>
    </>
  );
};

/** 勾 / 叉（SVG，draw-on）。kind: 'ok' | 'no' */
export const Mark: React.FC<{x: number; y: number; s?: number; kind: 'ok' | 'no'; start: number}> = ({x, y, s = 1, kind, start}) => {
  const f = useF();
  const p = prog(f, start, 10);
  if (f < start) return null;
  const d = kind === 'ok' ? `M ${x - 22 * s} ${y} l ${16 * s} ${18 * s} l ${32 * s} ${-40 * s}` : `M ${x - 20 * s} ${y - 20 * s} l ${40 * s} ${40 * s} M ${x + 20 * s} ${y - 20 * s} l ${-40 * s} ${40 * s}`;
  return <path d={d} stroke={kind === 'ok' ? P.ok : P.accent} strokeWidth={8 * s} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={200 * s} strokeDashoffset={200 * s * (1 - p)} />;
};

/** 划掉（荧光笔式横线穿过一段文字区域），SVG */
export const Strike: React.FC<{x: number; y: number; w: number; start: number}> = ({x, y, w, start}) => {
  const f = useF();
  const p = prog(f, start, 10);
  if (f < start) return null;
  return <line x1={x} y1={y} x2={x + w * p} y2={y - 4} stroke={P.accent} strokeWidth={7} strokeLinecap="round" />;
};

/** 荧光笔扫过（HTML 层，放在文字下面） */
export const Highlight: React.FC<{x: number; y: number; w: number; h?: number; start: number}> = ({x, y, w, h = 56, start}) => {
  const f = useF();
  const p = prog(f, start, 16);
  return <div style={{position: 'absolute', left: x, top: y, width: w * p, height: h, background: P.accent, opacity: 0.22, borderRadius: 6}} />;
};

/** 对话气泡（AI 的自述） */
export const Bubble: React.FC<{x: number; y: number; text: string; start: number; size?: number}> = ({x, y, text, start, size = 40}) => {
  const f = useF();
  const p = prog(f, start, 10);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: p, transform: `scale(${0.8 + 0.2 * p})`, transformOrigin: '0% 100%', background: P.white, border: `4px solid ${P.ink}`, borderRadius: 26, padding: '14px 26px', fontFamily: FONT, fontWeight: 800, fontSize: size, color: P.ink, whiteSpace: 'nowrap'}}>
      {text}
      <div style={{position: 'absolute', left: 26, bottom: -22, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `22px solid ${P.ink}`}} />
    </div>
  );
};

/**
 * 吊牌（评审 v1：口号卡不要空白纸，要"在工位上方落下一块吊牌"）。
 * 从画面顶外落下到 (cx, y)（牌子顶边），两根吊索连到 railY（默认 0 = 画面顶外/吊轨），落位后轻微阻尼摆动后静止；
 * 落定后在关键词下方画一笔橙红手绘下划线。num 可选：牌左侧的编号小方块（原则 1–4）。
 * 牌宽按字数自动估算。用法：放在工厂场景（Floor/Belt/Arm）之上，作为本工位的标题。
 */
export const Sign: React.FC<{text: string; cx?: number; y?: number; start: number; size?: number; num?: string; railY?: number}> = ({text, cx = 960, y = 250, start, size = 76, num, railY = -20}) => {
  const f = useF();
  const t = f - start;
  const drop = easeOut(t / 14);
  const swing = t > 12 ? Math.exp(-(t - 12) / 10) * Math.sin((t - 12) / 3) * 2.2 : 0;
  const dy = (1 - drop) * -(y + 260);
  const wText = [...text].reduce((s, ch) => s + (/[\x00-\x7F]/.test(ch) ? 0.58 : 1), 0) * size;
  const numW = num ? size * 1.25 : 0;
  const w = wText + numW + 90;
  const h = size + 70;
  const x0 = cx - w / 2;
  const under = prog(f, start + 18, 12);
  const UL = wText + 20;
  if (t < 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translateY(${dy}px) rotate(${swing}deg)`, transformOrigin: `${cx}px ${railY}px`}}>
      <Svg>
        <line x1={x0 + 50} y1={railY} x2={x0 + 50} y2={y} stroke={P.ink} strokeWidth={4} />
        <line x1={x0 + w - 50} y1={railY} x2={x0 + w - 50} y2={y} stroke={P.ink} strokeWidth={4} />
        <rect x={x0} y={y} width={w} height={h} rx={12} fill={P.white} stroke={P.ink} strokeWidth={5} />
        <circle cx={x0 + 50} cy={y + 14} r={6} fill={P.ink} />
        <circle cx={x0 + w - 50} cy={y + 14} r={6} fill={P.ink} />
        {num ? <rect x={x0 + 34} y={y + 30} width={size * 1.05} height={size * 1.05} rx={8} fill={P.accent} /> : null}
        <path d={`M ${x0 + 45 + numW} ${y + h - 22} q ${UL * 0.5} ${8} ${UL} ${-3}`} stroke={P.accent} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={UL * 1.1} strokeDashoffset={UL * 1.1 * (1 - under)} />
      </Svg>
      {num ? (
        <div style={{position: 'absolute', left: x0 + 34, top: y + 30, width: size * 1.05, height: size * 1.05, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size * 0.8, color: P.white, lineHeight: 1}}>{num}</div>
      ) : null}
      <div style={{position: 'absolute', left: x0 + 45 + numW, top: y + 26, fontFamily: FONT, fontWeight: 900, fontSize: size, color: P.ink, lineHeight: 1.05, whiteSpace: 'nowrap', letterSpacing: -1}}>{text}</div>
    </div>
  );
};
