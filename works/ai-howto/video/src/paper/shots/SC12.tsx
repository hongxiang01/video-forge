import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, FONT, Svg, Floor, Belt, Arm, Clock, Person, Card, Txt, Sign, Callout, Strike, ellipsePath, at, blk, prog, lerp, easeInOut, easeOut, clamp01, useF} from '../kit';

// SC12：S37–S42 第 4 条 小步迭代。
// S37 "第四条，|小步迭代，多出几版来挑"：工厂上方落下吊牌（4）；下方机械臂一张接一张往传送带上放草稿，每版都不一样。
// S38 "质量管理里有个老循环|计划、执行、检查、改进"：首尾相接的环形传送带，物件一直在跑；第 2 块起一个橙红物件跑一圈，环四边的工位牌"计划/执行/检查/改进"依次亮起。
// S39 "对人来说，返工很贵|对 AI 来说，返工几乎免费"：相机从左边人旁越堆越高的返工硬币横移到右边机械臂旁的一枚硬币。
// S40 "所以别指望一次成功"：吊牌"一次成功"落下后被划掉。
// S41 "让它一次给出几个差别很大的方向|你挑一个，|指出具体哪里不对，|再来一轮"：机械臂在长桌上放下圆/方/只有刻度的三只钟；人圈中间一只；相机推近，标注"这里不对"；拉开后右上小环形传送带上的物件再跑一圈。
// S42 "研究也发现，|让它一次列出好几个，|冷门的想法才会冒出来"：三只钟扩成一排六只，最冷门的日晷被橙红圈出（单指针钟用墨线圈）。

/** 编号卡（各条原则统一样式） */
const NumCard: React.FC<{n: number; start: number}> = ({n, start}) => {
  const f = useF();
  const p = prog(f, start, 12);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * -30}px)`}}>
      <Card x={70} y={70} w={110} h={110} style={{padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: 72, fontWeight: 900, color: P.accent, lineHeight: 1}}>{n}</div>
      </Card>
    </div>
  );
};

/** 段落可见度：a 淡入，b 淡出 */
const vis = (f: number, a: number, b: number) => Math.min(prog(f, a, 10), 1 - clamp01((f - b) / 10));

const Layer: React.FC<{op: number; children: React.ReactNode}> = ({op, children}) =>
  op > 0 ? <div style={{position: 'absolute', inset: 0, opacity: op}}>{children}</div> : null;

/** 关键帧相机：keys=[帧, 缩放, 焦点x, 焦点y]，焦点放到画面中心；相邻关键帧间 easeInOut，相同值即停留 */
type CamKey = [number, number, number, number];
const KCam: React.FC<{keys: CamKey[]; children: React.ReactNode}> = ({keys, children}) => {
  const f = useF();
  let k: CamKey = keys[keys.length - 1];
  if (f <= keys[0][0]) k = keys[0];
  else
    for (let i = 0; i < keys.length - 1; i++) {
      if (f < keys[i + 1][0]) {
        const t = easeInOut((f - keys[i][0]) / Math.max(1, keys[i + 1][0] - keys[i][0]));
        k = [f, lerp(keys[i][1], keys[i + 1][1], t), lerp(keys[i][2], keys[i + 1][2], t), lerp(keys[i][3], keys[i + 1][3], t)];
        break;
      }
    }
  const [, sc, cx, cy] = k;
  return <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${960 - cx * sc}px, ${540 - cy * sc}px) scale(${sc})`}}>{children}</div>;
};

const FLOOR_Y = 860;
const Ground: React.FC = () => (
  <g>
    <rect x={-400} y={FLOOR_Y} width={2720} height={400} fill={P.soft} />
    <line x1={-400} y1={FLOOR_Y} x2={2320} y2={FLOOR_Y} stroke={P.ink} strokeWidth={4} />
  </g>
);

// ───────── 钟的不同造型 ─────────
type Kind = 'round' | 'square' | 'ticks' | 'onehand' | 'octa' | 'sundial';
const hand = (cx: number, cy: number, deg: number, len: number, w: number, c = P.ink) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return <line x1={cx} y1={cy} x2={cx + Math.cos(rad) * len} y2={cy + Math.sin(rad) * len} stroke={c} strokeWidth={w} strokeLinecap="round" />;
};
const ticks12 = (cx: number, cy: number, r0: number, r1: number) =>
  Array.from({length: 12}).map((_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const k = i % 3 === 0 ? 1 : 0.55;
    return <line key={i} x1={cx + Math.cos(a) * (r1 - (r1 - r0) * k)} y1={cy + Math.sin(a) * (r1 - (r1 - r0) * k)} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={P.ink} strokeWidth={i % 3 === 0 ? 5 : 3} />;
  });

const Face: React.FC<{kind: Kind; cx: number; cy: number; r: number; h?: number; m?: number}> = ({kind, cx, cy, r, h = 4, m = 30}) => {
  const hA = ((h % 12) / 12) * 360 + (m / 60) * 30;
  const mA = (m / 60) * 360;
  const k = r / 90;
  const hands = (
    <g>
      {hand(cx, cy, hA, r * 0.5, 9 * k)}
      {hand(cx, cy, mA, r * 0.76, 6 * k)}
      <circle cx={cx} cy={cy} r={7 * k} fill={P.ink} />
    </g>
  );
  if (kind === 'round') return <Clock cx={cx} cy={cy} r={r} h={h} m={m} box={false} />;
  if (kind === 'square')
    return (
      <g>
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={14 * k} fill={P.bg} stroke={P.ink} strokeWidth={5} />
        {[0, 90, 180, 270].map((a) => {
          const rad = (a * Math.PI) / 180;
          return <line key={a} x1={cx + Math.sin(rad) * (r - 24 * k)} y1={cy - Math.cos(rad) * (r - 24 * k)} x2={cx + Math.sin(rad) * (r - 6 * k)} y2={cy - Math.cos(rad) * (r - 6 * k)} stroke={P.ink} strokeWidth={6 * k} />;
        })}
        {hands}
      </g>
    );
  if (kind === 'ticks')
    return (
      <g>
        {ticks12(cx, cy, r - 26 * k, r)}
        {hands}
      </g>
    );
  if (kind === 'onehand')
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={P.bg} stroke={P.ink} strokeWidth={5} />
        {ticks12(cx, cy, r - 16 * k, r - 4)}
        {hand(cx, cy, hA, r * 0.8, 7 * k)}
        <circle cx={cx} cy={cy} r={8 * k} fill={P.ink} />
      </g>
    );
  if (kind === 'octa') {
    const pts = Array.from({length: 8})
      .map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
      })
      .join(' ');
    return (
      <g>
        <polygon points={pts} fill={P.bg} stroke={P.ink} strokeWidth={5} strokeLinejoin="round" />
        {ticks12(cx, cy, r - 24 * k, r - 12 * k)}
        {hands}
      </g>
    );
  }
  // sundial：半圆盘 + 放射刻线 + 晷针投影
  return (
    <g>
      <path d={`M ${cx - r} ${cy + r * 0.35} A ${r} ${r} 0 0 1 ${cx + r} ${cy + r * 0.35} Z`} fill={P.bg} stroke={P.ink} strokeWidth={5} strokeLinejoin="round" />
      {Array.from({length: 7}).map((_, i) => {
        const a = Math.PI + (i / 6) * Math.PI;
        const oy = cy + r * 0.35;
        return <line key={i} x1={cx + Math.cos(a) * r * 0.55} y1={oy + Math.sin(a) * r * 0.55} x2={cx + Math.cos(a) * (r - 8)} y2={oy + Math.sin(a) * (r - 8)} stroke={P.ink} strokeWidth={3} />;
      })}
      <path d={`M ${cx} ${cy + r * 0.35} L ${cx} ${cy - r * 0.25} L ${cx + 14 * k} ${cy + r * 0.35} Z`} fill={P.ink} />
      <line x1={cx} y1={cy + r * 0.35} x2={cx - r * 0.62} y2={cy - r * 0.12} stroke={P.mid} strokeWidth={8 * k} strokeLinecap="round" />
    </g>
  );
};


// ───────── 环形传送带（PDCA） ─────────
const LB = {cx: 960, cy: 530, rx: 600, ry: 200};
const STATIONS = [
  {label: '计划', a: -90, px: 960, py: 222},
  {label: '执行', a: 0, px: 1745, py: 530},
  {label: '检查', a: 90, px: 960, py: 812},
  {label: '改进', a: 180, px: 175, py: 530},
];
const ellPt = (deg: number, dr = 0): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [LB.cx + Math.cos(r) * (LB.rx + dr), LB.cy + Math.sin(r) * (LB.ry + dr)];
};
/** 环形带 + 循环物件（SVG）。phase 传帧号持续转；hotT 0..1 是橙红物件跑一圈的进度（<0 不画） */
const LoopBelt: React.FC<{phase: number; hotT: number}> = ({phase, hotT}) => {
  const items = Array.from({length: 10}).map((_, i) => (i / 10) * 360 + phase * 0.9 + 18);
  const box = (deg: number, w: number, h: number, fill: string, key: string | number) => {
    const [x, y] = ellPt(deg);
    return <rect key={key} x={x - w / 2} y={y - h + 8} width={w} height={h} rx={5} fill={fill} stroke={P.ink} strokeWidth={4} />;
  };
  return (
    <g>
      {[-0.55, 0.55].map((k) => (
        <line key={k} x1={LB.cx + LB.rx * k} y1={LB.cy + LB.ry * 0.84 + 25} x2={LB.cx + LB.rx * k} y2={FLOOR_Y} stroke={P.ink} strokeWidth={4} />
      ))}
      <ellipse cx={LB.cx} cy={LB.cy} rx={LB.rx} ry={LB.ry} fill="none" stroke={P.soft} strokeWidth={50} />
      <ellipse cx={LB.cx} cy={LB.cy} rx={LB.rx} ry={LB.ry} fill="none" stroke={P.mid} strokeWidth={3} strokeDasharray="8 34" strokeDashoffset={-phase * 3} />
      <ellipse cx={LB.cx} cy={LB.cy} rx={LB.rx + 25} ry={LB.ry + 25} fill="none" stroke={P.ink} strokeWidth={4} />
      <ellipse cx={LB.cx} cy={LB.cy} rx={LB.rx - 25} ry={LB.ry - 25} fill="none" stroke={P.ink} strokeWidth={4} />
      {/* 后半圈先画，前半圈后画 */}
      {items.filter((d) => Math.sin((d * Math.PI) / 180) < 0).map((d, i) => box(d, 52, 40, P.soft, 'b' + i))}
      {items.filter((d) => Math.sin((d * Math.PI) / 180) >= 0).map((d, i) => box(d, 52, 40, P.soft, 'f' + i))}
      {hotT >= 0 ? box(-90 + 360 * clamp01(hotT), 66, 52, P.accent, 'hot') : null}
    </g>
  );
};
/** 工位牌（HTML + 连接线）。lit=亮起 */
const StationPlates: React.FC<{hotT: number; op: number}> = ({hotT, op}) => (
  <div style={{position: 'absolute', inset: 0, opacity: op}}>
    <Svg>
      {STATIONS.map((s, i) => {
        const [ex, ey] = ellPt(s.a, 25);
        const lit = hotT >= i * 0.25;
        return <line key={i} x1={s.px} y1={s.py} x2={ex} y2={ey} stroke={lit ? P.ink : P.mid} strokeWidth={4} />;
      })}
    </Svg>
    {STATIONS.map((s, i) => {
      const lit = hotT >= i * 0.25;
      return (
        <div key={s.label} style={{position: 'absolute', left: s.px - 95, top: s.py - 43, width: 190, height: 86, boxSizing: 'border-box', background: P.white, border: `5px solid ${lit ? P.ink : P.mid}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 52, color: lit ? P.ink : P.mid}}>
          {s.label}
          {lit ? <div style={{position: 'absolute', right: -10, top: -10, width: 22, height: 22, borderRadius: 11, background: P.accent}} /> : null}
        </div>
      );
    })}
  </div>
);

/** 草稿纸（每版线条不同） */
const Draft: React.FC<{x: number; top: number; k: number}> = ({x, top, k}) => (
  <g>
    <rect x={x - 60} y={top} width={120} height={150} rx={6} fill={P.white} stroke={P.ink} strokeWidth={4} />
    {k % 3 === 0 ? <circle cx={x} cy={top + 62} r={32} fill="none" stroke={P.ink} strokeWidth={5} /> : null}
    {k % 3 === 1 ? <rect x={x - 32} y={top + 30} width={64} height={64} rx={6} fill="none" stroke={P.ink} strokeWidth={5} /> : null}
    {k % 3 === 2 ? <path d={`M ${x - 34} ${top + 92} L ${x} ${top + 30} L ${x + 34} ${top + 92} Z`} fill="none" stroke={P.ink} strokeWidth={5} strokeLinejoin="round" /> : null}
    <line x1={x - 36} y1={top + 120} x2={x + 36 - (k % 2) * 30} y2={top + 120} stroke={P.mid} strokeWidth={5} strokeLinecap="round" />
  </g>
);

const X3 = [560, 960, 1360];
const X6 = [250, 530, 810, 1090, 1370, 1650];
const TABLE_Y = 690;
// 六只钟：前三只沿用 S41 的三只（落在 X6[1..3]），新冒出三只；cold=2 最冷门（橙红），cold=1 次冷门（墨线）
const SIX: Array<{kind: Kind; slot: number; from3?: number; cold?: number}> = [
  {kind: 'onehand', slot: 0, cold: 1},
  {kind: 'round', slot: 1, from3: 0},
  {kind: 'square', slot: 2, from3: 1},
  {kind: 'ticks', slot: 3, from3: 2},
  {kind: 'octa', slot: 4},
  {kind: 'sundial', slot: 5, cold: 2},
];

export const SC12: React.FC = () => {
  const f = useF();
  const s37 = at('S37');
  const s38 = at('S38');
  const s39 = at('S39');
  const s40 = at('S40');
  const s41 = at('S41');
  const s42 = at('S42');

  const opA = vis(f, s37.from - 12, s38.from - 8);
  const opB = vis(f, s38.from - 8, s39.from - 8);
  const opC = vis(f, s39.from - 8, s40.from - 8);
  const opD = vis(f, s40.from - 8, s41.from - 8);
  const opE = prog(f, s41.from - 8, 10);

  // ── S37 机械臂连续出草稿 ──
  const T0 = s37.from + 6;
  const CYC = 24;
  const u = (((f - T0) % CYC) + CYC) % CYC;
  const tyA = u < 12 ? lerp(550, 470, easeInOut(u / 12)) : lerp(470, 550, easeInOut((u - 12) / 12));
  const nDrop = Math.floor((f - T0) / CYC) + 1; // 已落下的张数
  const ARM_X = 200;

  // ── S38 环 ──
  const lap = blk('S38', 1);
  const hotT = f >= lap ? clamp01((f - lap) / 62) : -1;

  // ── S39 返工 ──
  const coins = Math.min(12, Math.max(0, Math.floor((f - (s39.from + 4)) / 3) + 1));
  const freeT = blk('S39', 1);

  // ── S41/S42 三只钟 → 六只 ──
  const drop = [0, 1, 2].map((k) => s41.from + 4 + k * 20);
  const armLeg = (k: number) => easeInOut((f - (drop[k] - 14)) / 12);
  let bx = X3[0];
  for (let k = 1; k < 3; k++) bx = lerp(bx, X3[k], armLeg(k));
  bx = lerp(bx, 640, easeInOut((f - (drop[2] + 24)) / 26)); // 放完退到左边，给小环路和标注让位
  const dip = Math.max(...drop.map((d) => Math.max(0, 1 - Math.abs(f - d) / 8)));
  const armUp = easeInOut((f - (drop[2] + 6)) / 16);
  const ty = lerp(lerp(410, 440, dip), 300, armUp);
  const pick = blk('S41', 1);
  const point = blk('S41', 2);
  const again = blk('S41', 3);
  const expand = blk('S42', 1);
  const cold = blk('S42', 2);
  const grow = easeInOut((f - expand) / 20);
  const s41only = 1 - prog(f, s42.from, 10);
  const againT = f >= again ? clamp01((f - again) / 34) : -1;

  return (
    <AbsoluteFill>
      {/* S37 吊牌 + 机械臂连续出草稿 */}
      <Layer op={opA}>
        <KCam keys={[[s37.from - 12, 1.0, 960, 540], [s38.from, 1.07, 900, 560]]}>
          <Svg>
            <Floor windows={false} />
            <Belt x0={60} x1={1860} y={720} phase={f} />
            {Array.from({length: Math.max(0, nDrop)}).map((_, k) => {
              const tk = T0 + k * CYC;
              return <Draft key={k} k={k} x={ARM_X + (f - tk) * 6} top={570} />;
            })}
            {f >= T0 - 12 ? <Draft k={Math.max(0, nDrop)} x={ARM_X} top={u >= 12 || f < T0 ? tyA + 20 : -400} /> : null}
            <Arm bx={ARM_X} tx={ARM_X} ty={tyA} railY={200} railX0={40} railX1={380} open={u < 4 ? 0.6 : 0} />
          </Svg>
        </KCam>
        <Sign text="小步迭代，多出几版来挑" num="4" cx={960} y={170} start={s37.from} size={84} />
      </Layer>

      {/* S38 环形传送带 PDCA */}
      <Layer op={opB}>
        <KCam keys={[[s38.from - 8, 1.0, 960, 560], [s39.from, 1.06, 960, 570]]}>
          <Svg>
            <Ground />
            <LoopBelt phase={f} hotT={hotT} />
          </Svg>
          <StationPlates hotT={hotT} op={prog(f, s38.from + 4, 12)} />
        </KCam>
      </Layer>

      {/* S39 返工：人贵 / AI 免费（相机横移） */}
      <Layer op={opC}>
        <KCam
          keys={[
            [s39.from - 8, 1.15, 640, 620],
            [freeT - 8, 1.15, 640, 620],
            [freeT + 16, 1.15, 1330, 600],
            [s40.from, 1.17, 1330, 600],
          ]}
        >
          <Svg>
            <Ground />
            <line x1={960} y1={220} x2={960} y2={FLOOR_Y - 20} stroke={P.mid} strokeWidth={3} strokeDasharray="12 12" />
            <Person x={360} floor={FLOOR_Y} s={1.1} board={false} />
            {Array.from({length: coins}).map((_, i) => (
              <ellipse key={i} cx={620 + (i % 2 === 0 ? 0 : 4)} cy={FLOOR_Y - 16 - i * 20} rx={66} ry={16} fill={P.soft} stroke={P.ink} strokeWidth={4} />
            ))}
            <Arm bx={1440} tx={1440} ty={460} railY={150} railX0={1040} railX1={1840} open={0.3} />
            {f >= freeT + 10 ? <ellipse cx={1680} cy={FLOOR_Y - 16} rx={66} ry={16} fill={P.soft} stroke={P.ink} strokeWidth={4} opacity={prog(f, freeT + 10, 8)} /> : null}
          </Svg>
          <Txt x={620} y={FLOOR_Y - 16 - Math.max(0, coins - 1) * 20 - 100} size={56} weight={900} center style={{opacity: prog(f, s39.from + 30, 10)}}>
            很贵
          </Txt>
          <Txt x={1680} y={FLOOR_Y - 120} size={56} weight={900} center style={{opacity: prog(f, freeT + 18, 10)}}>
            几乎免费
          </Txt>
        </KCam>
      </Layer>

      {/* S40 一次成功 → 划掉 */}
      <Layer op={opD}>
        <KCam keys={[[s40.from - 8, 1.0, 960, 500], [s41.from, 1.08, 960, 440]]}>
          <Svg>
            <Floor windows={false} />
            <Belt x0={60} x1={1860} y={720} phase={f} />
          </Svg>
          <Sign text="一次成功" cx={960} y={300} start={s40.from - 6} size={96} />
          <Svg>
            <Strike x={752} y={384} w={420} start={s40.from + 16} />
          </Svg>
        </KCam>
      </Layer>

      {/* S41–S42 三只钟 → 六只 */}
      <Layer op={opE}>
        <KCam
          keys={[
            [s41.from - 8, 1.0, 960, 540],
            [point - 6, 1.0, 960, 540],
            [point + 10, 1.25, 1010, 520],
            [again - 2, 1.25, 1010, 520],
            [again + 12, 1.0, 960, 540],
            [expand, 1.0, 960, 540],
            [s42.to + 40, 1.05, 960, 580],
          ]}
        >
          <Svg>
            <Ground />
            {/* 长桌 */}
            <rect x={120} y={TABLE_Y} width={1620} height={18} fill={P.soft} stroke={P.ink} strokeWidth={4} />
            {[180, 930, 1680].map((x) => (
              <line key={x} x1={x} y1={TABLE_Y + 18} x2={x} y2={FLOOR_Y} stroke={P.ink} strokeWidth={4} />
            ))}
            {SIX.map((c, i) => {
              if (c.from3 !== undefined) {
                const k = c.from3;
                const p = prog(f, drop[k], 8);
                if (p <= 0) return null;
                const x = lerp(X3[k], X6[c.slot], grow);
                const r = lerp(90, 78, grow);
                const y = TABLE_Y - 4 - r - (1 - p) * 40;
                return (
                  <g key={i} opacity={p}>
                    <Face kind={c.kind} cx={x} cy={y} r={r} />
                  </g>
                );
              }
              const p = prog(f, expand + 8 + (c.slot === 0 ? 0 : c.slot === 4 ? 6 : 12), 12);
              if (p <= 0) return null;
              const y = TABLE_Y - 4 - 78;
              return (
                <g key={i} opacity={p} transform={`translate(${X6[c.slot]} ${y}) scale(${0.7 + 0.3 * p}) translate(${-X6[c.slot]} ${-y})`}>
                  <Face kind={c.kind} cx={X6[c.slot]} cy={y} r={78} />
                </g>
              );
            })}
            <Arm bx={bx} tx={bx} ty={ty} railY={120} railX0={260} railX1={1560} open={dip > 0.3 ? 0.6 : 0.2} />
            {/* 你挑一个：圈中间一只 */}
            <path
              d={ellipsePath(X3[1], TABLE_Y - 94, 140, 140)}
              fill="none"
              stroke={P.accent}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={960}
              strokeDashoffset={960 * (1 - prog(f, pick, 15))}
              opacity={f >= pick ? s41only : 0}
            />
            {/* 再来一轮：小环形传送带上物件再跑一圈 */}
            {f >= again - 6 ? (
              <g opacity={Math.min(prog(f, again - 6, 8), s41only)} transform={`translate(1660 300) scale(0.32) translate(${-LB.cx} ${-LB.cy})`}>
                <LoopBelt phase={f} hotT={againT} />
              </g>
            ) : null}
            {/* 冷门的被点亮：最冷门橙红，次冷门墨线 */}
            {SIX.filter((c) => c.cold).map((c) => {
              const p = prog(f, cold + (c.cold === 2 ? 0 : 8), 15);
              return p > 0 ? <path key={c.slot} d={ellipsePath(X6[c.slot], TABLE_Y - 82, 126, 126)} fill="none" stroke={c.cold === 2 ? P.accent : P.ink} strokeWidth={c.cold === 2 ? 7 : 4} strokeLinecap="round" strokeDasharray={900} strokeDashoffset={900 * (1 - p)} /> : null;
            })}
            <g opacity={Math.min(prog(f, pick - 10, 10), s41only)}>
              <Person x={1846} floor={FLOOR_Y} s={0.9} board check={false} />
            </g>
          </Svg>
          {f >= point && s41only > 0 ? (
            <div style={{position: 'absolute', inset: 0, opacity: s41only}}>
              <Callout x={X3[1] + 32} y={TABLE_Y - 94 + 32} ex={1110} ey={420} len={200} label="这里不对" start={point} size={46} />
            </div>
          ) : null}
        </KCam>
      </Layer>

      <NumCard n={4} start={s38.from - 6} />
      <Txt x={70} y={930} size={32} weight={600} color={P.mid} style={{opacity: prog(f, s42.from, 10)}}>
        来源：arXiv 2510.01171
      </Txt>
    </AbsoluteFill>
  );
};
