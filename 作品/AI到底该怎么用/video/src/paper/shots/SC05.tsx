import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Person, Txt, Mark, at, blk, prog, lerp, easeInOut, clamp01, useF} from '../kit';
import {WorkOrder, StampArm, fieldCenter, CamK, CamKey} from './SC03';

// SC05：S14–S17 章末钩子。
// S14 "新一代模型已经能画对一些表了"：相机沿流水线横移，5 只钟依次亮出，3 只 4:30 打勾，2 只仍是 10:10。
// S15 "但这个习惯没变：|你不说的，它就猜最常见的"：工单"4:30"打勾（这次画对了），空栏照样被盖"最常见"（复用 SC03 盖章）。
// S16 "你想要的画面，|只存在你自己的脑子里"：右侧大剪影 + 思考云，云里是一只独特的钟（4:30，橙红表圈）；左边机械臂；虚线箭头从云指向机械臂，中途断开打问号。
// S17 "那怎么把它交出去？|这件事，人类其实练了很多年|只是对象是人"：第 2 块旁边出现两个小剪影（其一是新人）；第 3 块机械臂淡出，新人走到机械臂原位，相机跟着左移；断开的虚线改指向新人。

/** 思考云（一圈圆弧鼓包） */
const Cloud: React.FC<{cx: number; cy: number; rx: number; ry: number}> = ({cx, cy, rx, ry}) => {
  const N = 11;
  const pts = Array.from({length: N}).map((_, i) => {
    const a = (i / N) * Math.PI * 2;
    return {x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry};
  });
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % N];
    const r = Math.hypot(q.x - p.x, q.y - p.y) * 0.62;
    d += ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  });
  return <path d={d} fill={P.white} stroke={P.ink} strokeWidth={5} strokeLinejoin="round" />;
};

/** 两段式虚线箭头（中途断开）：p0→p1 一段，p2→p3 一段，t 0..1 依次画出 */
const BrokenArrow: React.FC<{p: number[]; t: number; head?: boolean}> = ({p, t, head = true}) => {
  if (t <= 0) return null;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const a = clamp01(t * 2);
  const b = clamp01(t * 2 - 1);
  const ang = Math.atan2(y3 - y2, x3 - x2);
  const hx = (d: number) => x3 - Math.cos(ang + d) * 30;
  const hy = (d: number) => y3 - Math.sin(ang + d) * 30;
  return (
    <g>
      <line x1={x0} y1={y0} x2={lerp(x0, x1, a)} y2={lerp(y0, y1, a)} stroke={P.ink} strokeWidth={7} strokeDasharray="20 15" strokeLinecap="round" />
      {b > 0 ? <line x1={x2} y1={y2} x2={lerp(x2, x3, b)} y2={lerp(y2, y3, b)} stroke={P.ink} strokeWidth={7} strokeDasharray="20 15" strokeLinecap="round" /> : null}
      {head && b >= 1 ? <path d={`M ${hx(0.5)} ${hy(0.5)} L ${x3} ${y3} L ${hx(-0.5)} ${hy(-0.5)}`} stroke={P.ink} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  );
};

const FLOOR_Y = 920;

export const SC05: React.FC = () => {
  const f = useF();
  const s14 = at('S14');
  const s15 = at('S15');
  const s16 = at('S16');
  const s17 = at('S17');
  const b151 = blk('S15', 1);
  const b161 = blk('S16', 1);
  const b171 = blk('S17', 1);
  const b172 = blk('S17', 2);

  // S14 流水线
  const lineOut = prog(f, s15.from - 6, 12);
  const clocks = [
    {x: 330, ok: true},
    {x: 590, ok: false},
    {x: 850, ok: true},
    {x: 1110, ok: false},
    {x: 1370, ok: true},
  ];
  const camA: CamKey[] = [
    [s14.from - 12, 1.12, 760, 560],
    [s14.to + 6, 1.12, 1040, 560],
  ];

  // S15 工单
  const woIn = prog(f, s15.from, 14);
  const woOut = prog(f, s16.from - 6, 12);
  const stamps = [b151 + 10, b151 + 28, b151 + 46];
  const camB: CamKey[] = [
    [s15.from - 2, 1, 960, 540],
    [s16.from, 1.08, 1000, 560],
  ];

  // S16–S17
  const s16In = prog(f, s16.from - 2, 14);
  const cloudIn = prog(f, s16.from + 10, 14);
  const arrow = prog(f, b161, 18);
  const qMark = prog(f, b161 + 18, 8);
  const armOut = prog(f, b172, 14);
  const pals = prog(f, b171 - 2, 14);
  const walk = easeInOut((f - (b172 + 6)) / 26);
  const newX = lerp(1200, 420, walk);
  const a2 = prog(f, b172 + 12, 16); // 章卡在 S17 末尾约 8 帧后盖上，虚线要在那之前画完
  const camC: CamKey[] = [
    [s16.from - 4, 1, 960, 540],
    [b171, 1.06, 980, 540],
    [b172 + 6, 1.06, 980, 540],
    [b172 + 34, 1.1, 900, 540],
    [s17.to + 60, 1.12, 900, 540],
  ];

  return (
    <AbsoluteFill>
      {/* S14：流水线，新一代模型画对了一些（相机沿带横移） */}
      {lineOut < 1 ? (
        <AbsoluteFill style={{opacity: 1 - lineOut}}>
          <CamK keys={camA}>
            <Svg>
              <Floor y={FLOOR_Y} />
              <Belt x0={20} x1={1700} y={700} floor={FLOOR_Y} phase={f} />
              <Arm bx={1620} tx={1620} ty={450} railX1={1860} open={0.2} />
              {clocks.map((c, i) => {
                const p = prog(f, s14.from + i * 9, 10);
                return (
                  <g key={i} opacity={p} transform={`translate(0 ${(1 - p) * -30})`}>
                    <Clock cx={c.x} cy={616} r={64} h={c.ok ? 4 : 10} m={c.ok ? 30 : 10} />
                  </g>
                );
              })}
              {clocks.map((c, i) => (c.ok ? <Mark key={i} x={c.x} y={480} s={1.4} kind="ok" start={s14.from + 14 + i * 9} /> : null))}
            </Svg>
          </CamK>
        </AbsoluteFill>
      ) : null}

      {/* S15：习惯没变——空栏又被盖"最常见" */}
      {f >= s15.from - 2 && woOut < 1 ? (
        <AbsoluteFill style={{opacity: 1 - woOut}}>
          <CamK keys={camB}>
            <WorkOrder op={woIn} q={clamp01((f - (s15.from + 10)) / 24)} stamps={[null, ...stamps]} />
            <Svg>
              <StampArm times={stamps} cols={[1, 2, 3]} x0={fieldCenter(1).x} op={woIn} />
              <Mark x={fieldCenter(0).x + 130} y={fieldCenter(0).y + 10} s={1.1} kind="ok" start={s15.from + 12} />
            </Svg>
          </CamK>
        </AbsoluteFill>
      ) : null}

      {/* S16–S17：画面只在你脑子里 → 对象是人 */}
      {f >= s16.from - 4 ? (
        <AbsoluteFill style={{opacity: s16In}}>
          <CamK keys={camC}>
            <Svg>
              <Floor y={FLOOR_Y} windows={false} />
              <g opacity={1 - armOut}>
                <Arm bx={420} tx={420} ty={530} railX0={120} railX1={800} open={0.3} />
              </g>
              <Person x={1520} floor={FLOOR_Y} s={1.5} board={false} />
              <g opacity={cloudIn} transform={`translate(1270 290) scale(${lerp(0.7, 1, cloudIn)}) translate(-1270 -290)`}>
                <circle cx={1452} cy={512} r={15} fill={P.white} stroke={P.ink} strokeWidth={4} />
                <circle cx={1420} cy={472} r={24} fill={P.white} stroke={P.ink} strokeWidth={4} />
                <Cloud cx={1270} cy={290} rx={215} ry={152} />
                <circle cx={1270} cy={290} r={104} fill="none" stroke={P.accent} strokeWidth={13} />
                <Clock cx={1270} cy={290} r={90} h={4} m={30} box={false} />
              </g>
              {/* 云 → 机械臂（中途断开） */}
              <g opacity={1 - armOut}>
                <BrokenArrow p={[1050, 340, 880, 385, 740, 422, 580, 466]} t={arrow} />
              </g>
              {/* 第 3 块后：同一条断开的虚线改指向新人 */}
              <BrokenArrow p={[1050, 380, 840, 470, 720, 520, 520, 604]} t={a2} />
              {/* 两个小剪影：一个"新人"（走到机械臂原位），一个留在旁边 */}
              <g opacity={pals}>
                <Person x={1690} floor={FLOOR_Y} s={1} board={false} color={P.mid} />
                <Person x={newX} floor={FLOOR_Y} s={1} board={false} />
              </g>
            </Svg>
            <Txt x={786} y={362} size={72} weight={900} style={{opacity: qMark * (1 - armOut)}}>
              ?
            </Txt>
            <Txt x={758} y={452} size={72} weight={900} style={{opacity: prog(f, b172 + 28, 6)}}>
              ?
            </Txt>
            <Txt x={newX} y={FLOOR_Y - 258 - 72} size={44} weight={900} center style={{opacity: pals}}>
              新人
            </Txt>
          </CamK>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
