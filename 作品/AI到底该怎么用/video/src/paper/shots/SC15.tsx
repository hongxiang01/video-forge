import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Gate, Card, Txt, Person, Callout, Mark, at, blk, prog, lerp, easeInOut, useF} from '../kit';

// SC15：S49–S52 全景流水线（工单入口 → 机械臂工位 → 检测门 → 出厂口），人站的三个位置。
// S49 "所以人要站在三个地方"：入口、门旁、出口三个虚线空位依次出现。
// S50 "站在开头，|定义要什么、不要什么"：Person 落在入口位，Callout "定义"。
// S51 "站在关口，|拦住收不回来的那一步"：Person 落在门旁，Gate 灯亮橙红、光束亮，门前的产品停住，Callout "拦住"。
// S52 "站在结尾，|判断好不好，|出了事由你担着"：Person 落在出口（验收板打勾），出厂箱旁 P.ok 勾，Callout "判断 · 担责"。

// ───────── 相机（SC13–SC17 共用）：关键帧 [帧, 缩放, 画面中心 x, 画面中心 y]，段间 easeInOut ─────────
export type CamKey = [number, number, number, number];
export const camXf = (f: number, keys: CamKey[]) => {
  let [, s, cx, cy] = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const [f0] = keys[i - 1];
    const [f1, s1, x1, y1] = keys[i];
    const t = easeInOut((f - f0) / Math.max(1, f1 - f0));
    s = lerp(s, s1, t);
    cx = lerp(cx, x1, t);
    cy = lerp(cy, y1, t);
  }
  return `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`;
};
export const CamDiv: React.FC<{f: number; keys: CamKey[]; children: React.ReactNode; style?: React.CSSProperties}> = ({f, keys, children, style}) => (
  <div style={{position: 'absolute', inset: 0, transform: camXf(f, keys), transformOrigin: '0 0', ...style}}>{children}</div>
);

// ───────── 全景（SC16 复用） ─────────
export const BELT_Y = 560;
export const FLOOR_Y = 760;
export const FEET = 960;
export const PS = 0.7; // 人物缩放
export const SPOTS = [170, 1210, 1730]; // 入口 / 关口 / 出口 的人物 x
const BX0 = 300;
const BX1 = 1600;
const LEN = BX1 - BX0;

/** 皮带上产品的位置：ip 为产品相位（帧），off 为偏移 */
const itemXs = (ip: number, off: number) => Array.from({length: 4}).map((_, i) => BX0 + ((((ip * 2 + off + i * 325) % LEN) + LEN) % LEN));

export const Panorama: React.FC<{f: number; ip: number; off?: number; lamp?: string; beam?: number; arms?: Array<{bx: number; ty: number}>}> = ({f, ip, off = 0, lamp = P.mid, beam = 0.3, arms = [{bx: 720, ty: 420}]}) => (
  <>
    <Svg>
      <Floor y={FLOOR_Y} />
      <Belt x0={BX0} x1={BX1} y={BELT_Y} floor={FLOOR_Y} phase={ip} />
      {/* 出厂口：滑槽 + 箱子 */}
      <path d={`M ${BX1 - 10} ${BELT_Y + 22} L ${1680} ${640}`} stroke={P.ink} strokeWidth={6} strokeLinecap="round" />
      <rect x={1640} y={640} width={200} height={120} rx={6} fill={P.soft} stroke={P.ink} strokeWidth={4} />
      {/* 入口：工单 → 皮带的箭头 */}
      <path d={`M 180 486 Q 190 560 ${BX0 + 20} ${BELT_Y - 30}`} stroke={P.ink} strokeWidth={5} fill="none" strokeDasharray="12 10" />
      <path d={`M ${BX0 + 20} ${BELT_Y - 30} l -24 -4 M ${BX0 + 20} ${BELT_Y - 30} l -12 -20`} stroke={P.ink} strokeWidth={5} strokeLinecap="round" />
      {itemXs(ip, off).map((x, i) =>
        x > BX0 + 30 && x < BX1 - 40 ? <Clock key={i} cx={x} cy={BELT_Y - 46} r={34} h={i % 2 ? 4 : 10} m={i % 2 ? 30 : 10} /> : null,
      )}
      <Gate x={1100} y={330} bottom={BELT_Y} w={200} lamp={lamp} beam={beam} />
      {arms.map((a, i) => (
        <Arm key={i} bx={a.bx} tx={a.bx} ty={a.ty} railY={120} railX0={BX0} railX1={1080} rail={i === 0} open={0.3 + 0.2 * Math.sin(f / 7 + i)} />
      ))}
    </Svg>
    <Card x={70} y={320} w={220} style={{padding: '14px 22px'}}>
      <div style={{fontSize: 40, fontWeight: 900, marginBottom: 6}}>工单</div>
      {[150, 120, 160].map((w, i) => (
        <div key={i} style={{width: w, height: 10, background: P.soft, borderRadius: 5, marginTop: i ? 12 : 4}} />
      ))}
    </Card>
    <Txt x={1740} y={672} size={42} center>
      出厂
    </Txt>
  </>
);

/** 空位：虚线圆 */
export const Spot: React.FC<{x: number; op: number; color?: string}> = ({x, op, color = P.mid}) => (
  <circle cx={x} cy={FEET - 92} r={100} fill="none" stroke={color} strokeWidth={4} strokeDasharray="14 12" opacity={op} />
);

/** 人物落位：从上方 40px 落下 + 淡入 */
export const Drop: React.FC<{x: number; f: number; start: number; board?: boolean}> = ({x, f, start, board = false}) => {
  const p = prog(f, start, 12);
  if (p <= 0) return null;
  return (
    <g transform={`translate(0 ${(1 - p) * -40})`} opacity={p}>
      <Person x={x} floor={FEET} s={PS} board={board} check={board} />
    </g>
  );
};

export const SC15: React.FC = () => {
  const f = useF();
  const s49 = at('S49');
  const s52 = at('S52');
  // 产品相位：S51 "拦住" 时停在门前，S52 起继续走
  const stop = blk('S51', 1);
  const resume = s52.from + 10;
  const ip = f < stop ? f : f < resume ? stop : f - (resume - stop);
  const off = (((750 - stop * 2) % LEN) + LEN) % LEN; // 让第 0 件产品恰好停在门前（x≈1050）
  const hot = prog(f, stop, 8);
  const lamp = hot > 0.5 ? P.accent : P.mid;
  const b50 = blk('S50', 0);
  const b51 = blk('S51', 0);
  const b52 = blk('S52', 0);
  // 相机：全景 → 推向入口 → 平移到关口 → 平移到出口 → 末块拉回全景
  const keys: CamKey[] = [
    [s49.from - 12, 1.0, 960, 540],
    [b50 - 6, 1.0, 960, 540],
    [b50 + 16, 1.45, 662, 690],
    [b51 - 6, 1.45, 662, 690],
    [b51 + 16, 1.45, 1060, 690],
    [b52 - 6, 1.45, 1060, 690],
    [b52 + 16, 1.45, 1258, 690],
    [blk('S52', 2) + 6, 1.45, 1258, 690],
    [s52.to + 6, 1.0, 960, 540],
  ];
  return (
    <AbsoluteFill>
      <CamDiv f={f} keys={keys}>
        <Panorama f={f} ip={ip} off={off} lamp={lamp} beam={lerp(0.3, 1, hot)} arms={[{bx: 720, ty: 420 + 14 * Math.sin(f / 9)}]} />
        <Svg>
          {SPOTS.map((x, i) => (
            <Spot key={i} x={x} op={prog(f, s49.from + 8 + i * 8, 10)} />
          ))}
          <Drop x={SPOTS[0]} f={f} start={b50} />
          <Drop x={SPOTS[1]} f={f} start={b51} />
          <Drop x={SPOTS[2]} f={f} start={b52} board />
          {f >= blk('S52', 1) ? <Mark x={1800} y={600} kind="ok" s={1.1} start={blk('S52', 1)} /> : null}
        </Svg>
        {f >= blk('S50', 1) ? <Callout x={196} y={880} ex={260} ey={830} len={130} label="定义" start={blk('S50', 1)} /> : null}
        {f >= blk('S51', 1) ? <Callout x={1184} y={880} ex={1120} ey={830} len={120} label="拦住" left start={blk('S51', 1)} /> : null}
        {f >= blk('S52', 1) ? <Callout x={1700} y={880} ex={1640} ey={830} len={220} label="判断 · 担责" left start={blk('S52', 1)} /> : null}
      </CamDiv>
    </AbsoluteFill>
  );
};
