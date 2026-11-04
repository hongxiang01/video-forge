import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, FONT, Svg, Belt, Arm, Person, Card, Txt, Sign, Mark, at, blk, prog, lerp, easeInOut, useF} from '../kit';
import {NumCard, Rig, CamKey, WorldBg, Pinned} from './SC07';

// SC09：S26–S30 第 2 条「按能不能撤回，决定管多严」。一条横向展开的车间，相机逐个工位横移。
// S26 "第二条，|按能不能撤回，决定管多严"：流水线工位上方落下吊牌（num 2），相机慢推。
// S27 "贝索斯在给股东的信里，|把决定分成两种"：横移到门厅，推近钉在墙上的来源卡；第 2 块拉远，左右两扇门露出来。
// S28 "走过去就回不来的，|叫单向门|不满意还能退回来的，|叫双向门"：左门先开，人走过去，门在身后关上；回程箭头停在门前打叉。右门开着，人走过去又走回来（往返虚线）。
// S29 "写草稿、换配图，|是双向门|放手让它做，做完再挑"：横移到双向门工位：草稿/配图卡穿过敞开的门，沿地面回流道返工循环，机械臂来回忙；出口排出 3 版，挑中一版。
// S30 "删文件、发出去、|和钱有关的事，|是单向门|先看方案，你点头再动手"：横移到单向门工位：三张卡停在关着的门前；第 3 块人和方案卡就位；第 4 块盖"批准"章，门打开放行。

/** 门：门框 + 左侧铰链门板。open 0=关 1=开（门板朝观众转出） */
const Door: React.FC<{x: number; y: number; w: number; h: number; open: number; sw?: number}> = ({x, y, w, h, open, sw = 6}) => {
  const th = (open * 78 * Math.PI) / 180;
  const pw = w * Math.cos(th);
  const sk = h * 0.06 * Math.sin(th);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={P.soft} stroke={P.ink} strokeWidth={sw} />
      <path d={`M ${x} ${y} L ${x + pw} ${y - sk} L ${x + pw} ${y + h + sk} L ${x} ${y + h} Z`} fill={P.white} stroke={P.ink} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <circle cx={x + pw * 0.85} cy={y + h * 0.52} r={Math.max(4, sw)} fill={P.ink} opacity={open < 0.85 ? 1 : 0} />
    </g>
  );
};

/** 逐步画出的箭头（dash=虚线）。head=箭头尖，dir=尖的朝向（弧度） */
const Arrow: React.FC<{id: string; d: string; p: number; head: number[]; dir: number; color?: string; dash?: boolean; w?: number}> = ({id, d, p, head, dir, color = P.ink, dash, w = 8}) => (
  <g>
    <mask id={id} maskUnits="userSpaceOnUse" x={-1000} y={-1000} width={12000} height={4000}>
      <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} stroke="#fff" strokeWidth={w + 10} fill="none" />
    </mask>
    <path d={d} stroke={color} strokeWidth={w} fill="none" strokeDasharray={dash ? '18 14' : undefined} strokeLinecap="round" mask={`url(#${id})`} />
    {p > 0.96 ? (
      <path
        d={`M ${head[0] - Math.cos(dir - 0.5) * 28} ${head[1] - Math.sin(dir - 0.5) * 28} L ${head[0]} ${head[1]} L ${head[0] - Math.cos(dir + 0.5) * 28} ${head[1] - Math.sin(dir + 0.5) * 28}`}
        stroke={color}
        strokeWidth={w}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : null}
  </g>
);

/** 传送带上的小卡（SVG） */
const Chip: React.FC<{cx: number; cy: number; text: string; w?: number; h?: number; size?: number; opacity?: number}> = ({cx, cy, text, w = 180, h = 84, size = 40, opacity = 1}) => (
  <g opacity={opacity}>
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={10} fill={P.white} stroke={P.ink} strokeWidth={5} />
    {text ? (
      <text x={cx} y={cy + size * 0.36} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={size} fill={P.ink}>
        {text}
      </text>
    ) : null}
  </g>
);

// 双向门工位（世界坐标 x≈4200–6120）：带面 + 地面回流弧，小卡沿闭环跑
const C = {belt0: 4440, belt1: 5640, top: 640, cy: 598};
const LOOP = {x0: 5600, x1: 4480, cx: 5040, cy: 1060};
const loopPos = (u: number): [number, number] => {
  const t = ((u % 1) + 1) % 1;
  if (t < 0.6) return [lerp(C.belt0 + 40, LOOP.x0, t / 0.6), C.cy];
  const s = (t - 0.6) / 0.4;
  const x = (1 - s) * (1 - s) * LOOP.x0 + 2 * s * (1 - s) * LOOP.cx + s * s * LOOP.x1;
  const y = (1 - s) * (1 - s) * C.cy + 2 * s * (1 - s) * LOOP.cy + s * s * C.cy;
  return [x, y];
};

export const SC09: React.FC = () => {
  const f = useF();
  const s26 = at('S26');
  const s27 = at('S27');
  const s28 = at('S28');
  const s29 = at('S29');
  const s30 = at('S30');

  // ── S27 来源卡
  const letterOp = Math.min(prog(f, s27.from + 4, 12), 1 - prog(f, s28.from - 4, 10));

  // ── S28 两扇门 + 两个人
  const b28 = [blk('S28', 0), blk('S28', 1), blk('S28', 2), blk('S28', 3)];
  const lOpen = Math.min(prog(f, b28[0] + 2, 10), 1 - prog(f, b28[0] + 34, 8, easeInOut));
  const p1x = lerp(2330, 2960, easeInOut((f - (b28[0] + 8)) / 26));
  const lBack = prog(f, b28[1] + 2, 12);
  const rOpen = prog(f, b28[2] - 4, 10);
  const go2 = easeInOut((f - (b28[2] + 4)) / 22);
  const back2 = easeInOut((f - (b28[2] + 30)) / 24);
  const p2x = lerp(lerp(3150, 3720, go2), 3150, back2);

  // ── S29 双向门工位
  const b29 = [blk('S29', 0), blk('S29', 1), blk('S29', 2)];
  const run0 = b29[2];
  const tRun = Math.max(0, Math.min(f, s30.from) - run0);
  const enter = easeInOut((f - (b29[0] + 4)) / 22);
  const chips = [
    {text: '草稿', u0: 0.12},
    {text: '配图', u0: 0.36},
  ];
  const armSwing = tRun > 0 ? Math.sin((tRun / 18) * Math.PI) : 0;
  const armBx = 4740 + 150 * armSwing * Math.min(1, tRun / 8);
  const versions = [run0 + 18, run0 + 26, run0 + 34];

  // ── S30 单向门工位
  const b30 = [blk('S30', 0), blk('S30', 1), blk('S30', 2), blk('S30', 3)];
  const planAt = b30[2] - 2;
  const stampAt = b30[3] + 8;
  const stampP = prog(f, stampAt, 6);
  const gateOpen = prog(f, stampAt + 8, 12);
  const pass = easeInOut((f - (stampAt + 14)) / 30) * 560;
  const queue = [
    {text: '删文件', x: 6800, t: b30[0] + 2},
    {text: '发出去', x: 6990, t: b30[0] + 18},
    {text: '¥', x: 7180, t: b30[1] + 2},
  ];

  const keys: CamKey[] = [
    [s26.from - 12, 900, 540, 1.0],
    [s26.from + 40, 1000, 520, 1.05],
    [s27.from - 4, 1020, 520, 1.06],
    [s27.from + 26, 3030, 600, 1.25],
    [blk('S27', 1), 3030, 600, 1.27],
    [blk('S27', 1) + 24, 3030, 560, 1.0],
    [s28.to, 3030, 560, 1.04],
    [s29.from + 20, 5160, 540, 1.0],
    [s30.from - 8, 5160, 540, 1.04],
    [s30.from + 22, 7360, 540, 1.0],
    [s30.to + 10, 7380, 540, 1.05],
  ];

  return (
    <AbsoluteFill>
      <Rig keys={keys}>
        <Svg>
          <WorldBg x0={-400} x1={8800} />
          {/* 工位 A：流水线 */}
          <Belt x0={60} x1={1700} y={700} phase={f} />
          <Chip cx={470} cy={652} text="" w={130} h={96} />
          <Chip cx={980} cy={652} text="" w={130} h={96} />
          <Arm bx={280} tx={470} ty={540} railX0={60} railX1={900} open={0.3} />

          {/* 门厅：单向门 / 双向门 */}
          <Door x={2500} y={420} w={260} h={480} open={lOpen} />
          <Door x={3300} y={420} w={260} h={480} open={rOpen} />
          <g>
            <Person x={p1x} floor={900} s={0.75} board={false} opacity={prog(f, s28.from - 6, 10)} />
            {f >= b28[1] ? <Arrow id="l-back" d="M 2960 650 L 2782 650" p={lBack} head={[2782, 650]} dir={Math.PI} dash /> : null}
            {f >= b28[1] + 14 ? <Mark x={2870} y={650} kind="no" s={1.1} start={b28[1] + 14} /> : null}
          </g>
          <g>
            {f >= b28[2] + 4 ? <Arrow id="r-go" d="M 3150 600 L 3720 600" p={prog(f, b28[2] + 4, 22)} head={[3720, 600]} dir={0} dash /> : null}
            {f >= b28[2] + 28 ? <Arrow id="r-back" d="M 3720 600 C 3800 600 3800 660 3720 660 L 3150 660" p={prog(f, b28[2] + 28, 26)} head={[3150, 660]} dir={Math.PI} dash /> : null}
            <Person x={p2x} floor={900} s={0.75} board={false} opacity={prog(f, b28[2] - 6, 10)} />
          </g>

          {/* 双向门工位 */}
          <Belt x0={C.belt0} x1={C.belt1} y={C.top} floor={900} phase={tRun > 0 ? tRun * 3 : 0} />
          <Arrow id="loop" d={`M ${LOOP.x0} ${C.cy + 50} Q ${LOOP.cx} ${LOOP.cy} ${LOOP.x1} ${C.cy + 50}`} p={prog(f, b29[1] - 2, 18)} head={[LOOP.x1, C.cy + 50]} dir={Math.atan2(-(LOOP.cy - C.cy - 50), LOOP.x1 - LOOP.cx)} color={P.mid} dash w={7} />
          <Door x={5280} y={380} w={160} h={260} open={1} sw={6} />
          {chips.map((c, i) => {
            const [x, y] = tRun > 0 ? loopPos(c.u0 + tRun / 45) : [lerp(4250 + i * 200, loopPos(c.u0)[0], enter), C.cy];
            return <Chip key={i} cx={x} cy={y} text={c.text} opacity={prog(f, b29[0], 10)} />;
          })}
          {versions.map((t, i) => (f >= t ? <Chip key={i} cx={5800} cy={420 + i * 100} text={`第 ${i + 1} 版`} w={200} h={80} size={38} opacity={prog(f, t, 8)} /> : null))}
          {f >= versions[2] + 12 ? <Mark x={5960} y={530} kind="ok" s={1.1} start={versions[2] + 12} /> : null}
          <Arm bx={armBx} tx={armBx} ty={470} railX0={4460} railX1={5900} open={0.3} />

          {/* 单向门工位 */}
          <Belt x0={6640} x1={8000} y={700} floor={900} phase={f >= s30.from ? f : 0} />
          <Door x={7300} y={360} w={220} h={340} open={gateOpen} />
          {queue.map((c, i) => {
            const p = prog(f, c.t, 16);
            return f >= c.t ? <Chip key={i} cx={lerp(c.x - 300, c.x, p) + pass} cy={658} text={c.text} opacity={p} size={c.text === '¥' ? 48 : 40} /> : null;
          })}
          <Person x={8090} floor={900} s={1.0} check={f >= stampAt + 4} opacity={prog(f, planAt, 10)} />
        </Svg>

        {/* 吊牌 */}
        <Sign text="按能不能撤回，决定管多严" num="2" cx={1090} y={230} start={s26.from + 2} />

        {/* 门厅墙上：来源卡 */}
        <Pinned x={2800} y={470} w={460} h={260} rot={-1.5} opacity={letterOp}>
          <div style={{fontSize: 40, fontWeight: 800, color: P.mid, textAlign: 'center'}}>贝索斯</div>
          <div style={{fontSize: 56, fontWeight: 900, marginTop: 10, textAlign: 'center', lineHeight: 1.15}}>2015 年度</div>
          <div style={{fontSize: 56, fontWeight: 900, textAlign: 'center', lineHeight: 1.15}}>致股东信</div>
        </Pinned>
        <Txt x={2630} y={330} size={60} weight={900} center style={{opacity: prog(f, b28[1] - 2, 8)}}>
          单向门
        </Txt>
        <Txt x={3430} y={330} size={60} weight={900} center style={{opacity: prog(f, b28[3] - 2, 8)}}>
          双向门
        </Txt>
        <Txt x={5360} y={290} size={56} weight={900} center style={{opacity: prog(f, b29[1] - 2, 8)}}>
          双向门
        </Txt>
        <Txt x={7410} y={270} size={60} weight={900} center style={{opacity: prog(f, b30[2] - 2, 8)}}>
          单向门
        </Txt>
        {/* 方案卡 + 批准章 */}
        {f >= planAt ? (
          <div style={{position: 'absolute', inset: 0, opacity: prog(f, planAt, 10), transform: `translateY(${(1 - prog(f, planAt, 12)) * 20}px)`}}>
            <Card x={7880} y={330} w={300} h={190} style={{padding: '18px 26px'}}>
              <div style={{fontSize: 48, fontWeight: 900}}>方案</div>
              <div style={{height: 6, width: 200, background: P.soft, marginTop: 16}} />
              <div style={{height: 6, width: 140, background: P.soft, marginTop: 14}} />
            </Card>
            {f >= stampAt ? (
              <div
                style={{
                  position: 'absolute',
                  left: 8010,
                  top: 420,
                  opacity: stampP,
                  transform: `rotate(-10deg) scale(${lerp(1.8, 1, stampP)})`,
                  border: `6px solid ${P.accent}`,
                  borderRadius: 8,
                  padding: '4px 16px',
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: 52,
                  color: P.accent,
                  background: P.white,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                批准
              </div>
            ) : null}
          </div>
        ) : null}
      </Rig>
      <NumCard n={2} start={s27.from + 24} />
      <Txt x={70} y={930} size={32} weight={600} color={P.mid} style={{opacity: prog(f, blk('S27', 1), 10)}}>
        贝索斯 · 2015 年度致股东信
      </Txt>
    </AbsoluteFill>
  );
};
