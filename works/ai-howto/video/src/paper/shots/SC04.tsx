import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Person, Txt, Keyword, Mark, at, blk, prog, lerp, easeInOut, clamp01, useF} from '../kit';
import {CamK, CamKey} from './SC03';

// SC04：S10–S13 打分偏爱眼熟 → 越来越保险 → 七十多个模型答案趋同。
// S10 "研究者发现，|人给 AI 打分的时候，|也会偏爱眼熟的那一个"：传送带上 A（10:10 眼熟款）B（六角新奇款）；剪影举牌，勾落在 A 上；相机推近。来源 arXiv。
// S11 "一来二去，|它越来越爱给最保险的答案"：传送带开动，钟一件件送到剪影面前：新奇款被挑掉（抬起淡出），眼熟款打勾通过；后面送来的全是 10:10；上方画出由宽到窄的漏斗线框；相机跟带横移。
// S12 "有人拿两万多个问题，|去问七十多个模型"：拉远：6×3 张问题卡先铺开（底排旁"2 万多个问题"），再落下 18 只小机械臂（顶排旁"70+ 个模型"）。
// S13 "答案像得惊人，|就像在问同一个人"：每只小机械臂夹出同一只 10:10 钟，同时放下；关键词"像在问同一个人"。来源 NeurIPS 2025。

/** 新奇款钟：六角外壳、点状刻度、偏心小表盘 */
const NovelClock: React.FC<{cx: number; cy: number; r?: number; opacity?: number}> = ({cx, cy, r = 52, opacity = 1}) => {
  const R = r + 22;
  const pts = Array.from({length: 6})
    .map((_, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return `${(cx + Math.cos(a) * R).toFixed(1)},${(cy + Math.sin(a) * R).toFixed(1)}`;
    })
    .join(' ');
  const hand = (deg: number, len: number, w: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * len} y2={cy + Math.sin(a) * len} stroke={P.ink} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <g opacity={opacity}>
      <polygon points={pts} fill={P.bg} stroke={P.ink} strokeWidth={4} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={P.mid} strokeWidth={3} strokeDasharray="4 7" />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return <circle key={i} cx={cx + Math.cos(a) * r * 0.62} cy={cy + Math.sin(a) * r * 0.62} r={5} fill={P.ink} />;
      })}
      {hand(135, r * 0.42, 10)}
      {hand(180, r * 0.6, 5)}
      <circle cx={cx} cy={cy} r={7} fill={P.ink} />
    </g>
  );
};

// 流水线几何（S10–S11）
const FLOOR_Y = 920;
const BELT_Y = 700;
const CR = 64; // 钟半径（盒子 ±82）
const CY = BELT_Y - 84;
const GATE_X = 1250; // 剪影面前的"打分点"
const PERSON_X = 1560;
// 流：k=0 是 B（新奇，最靠前），k=1 是 A（眼熟），之后新奇款越来越少
const STREAM: Array<{x: number; novel: boolean}> = [
  {x: 900, novel: true},
  {x: 600, novel: false},
  {x: 300, novel: true},
  {x: 0, novel: false},
  {x: -300, novel: false},
  {x: -600, novel: false},
  {x: -900, novel: false},
  {x: -1200, novel: false},
];
const SPEED = 14;

// S12/S13 小机械臂单元（本地坐标：小车在 (0,0)，问题卡在 y 300..384）
const UNIT_S = 0.5;
const COLS = 6;
const ROWS = 3;
const ROW_Y = [90, 305, 520];
const unitPos = (i: number) => ({x: 220 + (i % COLS) * 215, y: ROW_Y[Math.floor(i / COLS)]});

const MiniUnit: React.FC<{x: number; y: number; card: number; arm: number; hold: number; drop: number; land: number}> = ({x, y, card, arm, hold, drop, land}) => {
  const armY = lerp(-120, 0, arm);
  const clockY = lerp(260, 340, drop);
  return (
    <g transform={`translate(${x} ${y}) scale(${UNIT_S})`}>
      <g opacity={card * (1 - land)}>
        <rect x={-70} y={296} width={140} height={92} rx={8} fill={P.white} stroke={P.ink} strokeWidth={6} />
        <text x={0} y={368} textAnchor="middle" fontSize={80} fontWeight={900} fill={P.ink} fontFamily="sans-serif">
          ?
        </text>
      </g>
      <g opacity={arm} transform={`translate(0 ${armY})`}>
        <rect x={-120} y={-13} width={240} height={26} fill={P.soft} stroke={P.ink} strokeWidth={6} />
        <Arm bx={0} tx={0} ty={200} railY={0} rail={false} open={hold > 0 && drop <= 0 ? 0.35 : 0.8} />
      </g>
      {hold > 0 ? <Clock cx={0} cy={clockY} r={40} h={10} m={10} hot opacity={hold} /> : null}
    </g>
  );
};

export const SC04: React.FC = () => {
  const f = useF();
  const s10 = at('S10');
  const s11 = at('S11');
  const s12 = at('S12');
  const s13 = at('S13');
  const b101 = blk('S10', 1);
  const b102 = blk('S10', 2);
  const b111 = blk('S11', 1);
  const b121 = blk('S12', 1);
  const b131 = blk('S13', 1);

  // S12 拉远：前景流水线缩小淡出
  const zoom = easeInOut((f - (s12.from - 10)) / 22);

  // S11 传送带开动
  const t0 = s11.from - 4;
  const moved = Math.max(0, f - t0) * SPEED;
  const runIn = prog(f, s11.from - 8, 10);
  const funnel = clamp01((f - b111) / 26);

  const camA: CamKey[] = [
    [s10.from - 12, 1, 960, 540],
    [b102 + 12, 1.12, 960, 590],
    [s11.from + 10, 1.12, 960, 590],
    [s12.from - 10, 1.12, 1080, 580],
  ];
  const camB: CamKey[] = [
    [s12.from - 10, 1, 960, 540],
    [s13.to + 40, 1.08, 960, 520],
  ];

  return (
    <AbsoluteFill>
      {zoom < 1 ? (
        <AbsoluteFill style={{opacity: clamp01(1 - zoom * 1.6), transform: `scale(${lerp(1, 0.35, zoom)})`, transformOrigin: '960px 560px'}}>
          <CamK keys={camA}>
            <Svg>
              <Floor y={FLOOR_Y} />
              <Belt x0={-300} x1={1420} y={BELT_Y} floor={FLOOR_Y} phase={f < t0 ? f : t0 + (f - t0) * (SPEED / 2)} />
              {STREAM.map((it, k) => {
                const x = it.x + moved;
                const show = k < 2 ? prog(f, s10.from - 4 + k * 10, 12) : runIn;
                if (show <= 0 || x > 1500 || x < -200) return null;
                // 到了打分点：新奇款被挑掉，眼熟款通过
                const crossT = t0 + (GATE_X - it.x) / SPEED;
                const rej = it.novel ? prog(f, crossT, 12) : 0;
                const exit = prog(f, t0 + (1400 - it.x) / SPEED, 6);
                const op = show * (1 - rej) * (1 - exit);
                if (op <= 0) return null;
                return (
                  <g key={k} transform={`translate(0 ${-70 * rej})`}>
                    {it.novel ? <NovelClock cx={x} cy={CY} r={CR} opacity={op} /> : <Clock cx={x} cy={CY} r={CR} h={10} m={10} opacity={op} />}
                    {!it.novel && f >= crossT && f < crossT + 18 ? (
                      <g opacity={1 - prog(f, crossT + 10, 8)}>
                        <Mark x={x} y={CY - 130} s={1.3} kind="ok" start={crossT} />
                      </g>
                    ) : null}
                  </g>
                );
              })}
              {/* S10：勾落在眼熟款 A 上 */}
              {f < t0 + 2 ? <Mark x={600} y={CY - 130} s={1.5} kind="ok" start={b102 + 14} /> : null}
              {/* 由宽到窄的漏斗线框 */}
              {funnel > 0 ? (
                <g>
                  <path d="M 120 368 L 1180 368 L 700 492 L 600 492 Z" fill="none" stroke={P.ink} strokeWidth={5} strokeDasharray={2600} strokeDashoffset={2600 * (1 - funnel)} strokeLinejoin="round" />
                  <path d="M 650 492 L 650 524" stroke={P.ink} strokeWidth={5} strokeDasharray="10 10" opacity={clamp01(funnel * 2 - 1)} />
                </g>
              ) : null}
              <g opacity={prog(f, b101 - 4, 12)}>
                <Person x={PERSON_X} floor={FLOOR_Y} s={1.25} board check={false} />
              </g>
            </Svg>
          </CamK>
        </AbsoluteFill>
      ) : null}
      {zoom < 1 ? (
        <Txt x={70} y={942} size={32} weight={600} color={P.mid} style={{opacity: prog(f, s10.from + 4, 10) * clamp01(1 - zoom * 1.6)}}>
          典型性偏差 · 来源：arXiv 2510.01171
        </Txt>
      ) : null}

      {/* S12–S13：一排排小机械臂 */}
      {f >= s12.from - 10 ? (
        <>
          <CamK keys={camB}>
            <Svg>
              {Array.from({length: COLS * ROWS}).map((_, i) => {
                const u = unitPos(i);
                const card = prog(f, s12.from - 2 + (i % COLS) * 2 + Math.floor(i / COLS) * 4, 10);
                const arm = prog(f, b121 - 4 + ((i * 7) % 18), 12);
                const hold = prog(f, s13.from + 4, 10);
                const drop = easeInOut((f - (b131 - 2)) / 8);
                const land = prog(f, b131 + 4, 4);
                return <MiniUnit key={i} x={u.x} y={u.y} card={card} arm={arm} hold={hold} drop={drop} land={land} />;
              })}
              {/* 标签引线：顶排机械臂 / 底排问题卡 */}
              <line x1={1400} y1={ROW_Y[0] + 50} x2={1440} y2={ROW_Y[0] + 50} stroke={P.ink} strokeWidth={4} opacity={prog(f, b121, 12)} />
              <line x1={1340} y1={ROW_Y[2] + 170} x2={1440} y2={ROW_Y[2] + 170} stroke={P.ink} strokeWidth={4} opacity={prog(f, s12.from + 6, 12) * (1 - prog(f, b131 + 4, 6))} />
            </Svg>
            <Txt x={1456} y={ROW_Y[0] + 18} size={60} weight={900} style={{opacity: prog(f, b121, 12)}}>
              70+ 个模型
            </Txt>
            <Txt x={1456} y={ROW_Y[2] + 138} size={60} weight={900} style={{opacity: prog(f, s12.from + 6, 12) * (1 - prog(f, b131 + 4, 6))}}>
              2 万多个问题
            </Txt>
            {f >= b131 - 4 ? <Keyword text="像在问同一个人" cx={1000} cy={812} start={b131 - 4} size={92} circle={false} /> : null}
          </CamK>
          <Txt x={70} y={942} size={32} weight={600} color={P.mid} style={{opacity: prog(f, s12.from + 6, 10)}}>
            来源：Artificial Hivemind，NeurIPS 2025
          </Txt>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
