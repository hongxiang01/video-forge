import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Person, Txt, Keyword, Bubble, Strike, at, blk, prog, easeInOut, useF} from '../kit';
import {CamDiv} from './SC15';

// SC14：S45–S48 METR 2025 实验：车间墙上的一块看板（条形图）+ 墙上的大秒表。
// S45 "有个实验请来一群资深程序员|用 AI 之前，|他们觉得能快两成多"：一排程序员剪影站到看板前；"事前预计"条向右长到 +24%。相机从看板左上特写拉开。
// S46 "做完以后，|他们觉得自己确实快了"：第二根"事后感觉"条 +20%。
// S47 "可是一掐表，|他们反而慢了差不多两成"：相机推向秒表与第三行；秒表按下、指针转；"实测"条向左长到 −19%（橙红）。
// S48 "AI 说做完了，|你觉得变快了|都不算数，|只有结果算数"：气泡"做完了！"被划掉，前两根条变灰；相机拉回，Keyword "只有结果算数"（带圈）。

const BOARD = {x: 110, y: 70, w: 1460, h: 700};
const ZX = 820; // 零线 x
const K = 22; // 每 1% 的像素
const BH = 100; // 条高
const ROWS = [
  {label: '事前预计', v: 24, y: 210},
  {label: '事后感觉', v: 20, y: 360},
  {label: '实测', v: -19, y: 510},
];
const AXIS_Y = 650;
const SW = {cx: 1745, cy: 470, r: 120};

// 秒表（新图元，只在本镜头用）
const Stopwatch: React.FC<{cx: number; cy: number; r: number; press: number; sweep: number}> = ({cx, cy, r, press, sweep}) => {
  const rad = ((sweep - 90) * Math.PI) / 180;
  return (
    <g>
      <line x1={cx} y1={-20} x2={cx} y2={cy - r - 50} stroke={P.ink} strokeWidth={4} />
      <rect x={cx - 22} y={cy - r - 54 + press * 16} width={44} height={34} rx={6} fill={P.ink} />
      <rect x={cx - 38} y={cy - r - 26} width={76} height={22} rx={6} fill={P.soft} stroke={P.ink} strokeWidth={5} />
      <circle cx={cx} cy={cy} r={r} fill={P.white} stroke={P.ink} strokeWidth={8} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.cos(a) * (r - 24)} y1={cy + Math.sin(a) * (r - 24)} x2={cx + Math.cos(a) * (r - 8)} y2={cy + Math.sin(a) * (r - 8)} stroke={P.ink} strokeWidth={i % 3 === 0 ? 6 : 3} />;
      })}
      <line x1={cx} y1={cy} x2={cx + Math.cos(rad) * (r - 30)} y2={cy + Math.sin(rad) * (r - 30)} stroke={P.accent} strokeWidth={8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={10} fill={P.ink} />
    </g>
  );
};

export const SC14: React.FC = () => {
  const f = useF();
  const s45 = at('S45');
  const s47 = at('S47');
  const s48 = at('S48');
  const grow = [prog(f, blk('S45', 2), 26, easeInOut), prog(f, blk('S46', 1), 24, easeInOut), prog(f, blk('S47', 1), 26, easeInOut)];
  // 变灰：第二根在"你觉得变快了"，第一根在"都不算数"
  const gray = [prog(f, blk('S48', 2), 12), prog(f, blk('S48', 1), 12), 0];
  const press = f < blk('S47', 0) ? 0 : 1 - prog(f, blk('S47', 0) + 6, 8);
  const sweep = Math.max(0, f - blk('S47', 0)) * 9;
  const kwT = blk('S48', 3) - 4;
  const s46 = at('S46');
  const keys: Array<[number, number, number, number]> = [
    [s45.from - 12, 1.0, 960, 540],
    [blk('S45', 1) - 6, 1.0, 960, 540],
    [blk('S45', 1) + 20, 1.25, 900, 500],
    [s46.from - 4, 1.25, 900, 500],
    [s46.from + 20, 1.0, 960, 540],
    [s47.from - 4, 1.0, 960, 540],
    [s47.from + 20, 1.2, 1120, 480],
    [s48.from + 10, 1.2, 1120, 480],
    [s48.from + 40, 1.0, 960, 540],
  ];
  return (
    <AbsoluteFill>
      <CamDiv f={f} keys={keys}>
        <Svg>
          <Floor y={850} windows={false} />
          {/* 看板：吊挂在车间墙上 */}
          <line x1={BOARD.x + 120} y1={-20} x2={BOARD.x + 120} y2={BOARD.y} stroke={P.ink} strokeWidth={4} />
          <line x1={BOARD.x + BOARD.w - 120} y1={-20} x2={BOARD.x + BOARD.w - 120} y2={BOARD.y} stroke={P.ink} strokeWidth={4} />
          <rect x={BOARD.x} y={BOARD.y} width={BOARD.w} height={BOARD.h} rx={12} fill={P.white} stroke={P.ink} strokeWidth={6} />
          {/* 零线 + 刻度 */}
          <line x1={ZX} y1={170} x2={ZX} y2={AXIS_Y} stroke={P.ink} strokeWidth={6} />
          <line x1={ZX - 500} y1={AXIS_Y} x2={ZX + 640} y2={AXIS_Y} stroke={P.mid} strokeWidth={3} />
          {[-20, -10, 10, 20].map((v) => (
            <line key={v} x1={ZX + v * K} y1={AXIS_Y} x2={ZX + v * K} y2={AXIS_Y + 16} stroke={P.mid} strokeWidth={3} />
          ))}
          {ROWS.map((r, i) => {
            const w = r.v * K * grow[i];
            const x = Math.min(ZX, ZX + w);
            const neg = r.v < 0;
            return grow[i] > 0 ? <rect key={i} x={x} y={r.y} width={Math.abs(w)} height={BH} fill={neg ? P.accent : P.soft} stroke={gray[i] > 0.5 ? P.mid : P.ink} strokeWidth={5} opacity={1 - 0.6 * gray[i]} /> : null;
          })}
          <Stopwatch cx={SW.cx} cy={SW.cy} r={SW.r} press={press} sweep={sweep} />
          {/* 一群资深程序员站在看板前 */}
          {Array.from({length: 5}).map((_, i) => (
            <g key={i} opacity={prog(f, s45.from + i * 4, 12) * (1 - prog(f, s47.from - 8, 10))}>
              <Person x={1640 + i * 56} floor={975} s={0.48} board={false} />
            </g>
          ))}
        </Svg>
        <Txt x={BOARD.x + 40} y={BOARD.y + 26} size={40} color={P.mid}>
          用 AI 写代码 · 速度变化
        </Txt>
        {ROWS.map((r, i) => (
          <Txt key={i} x={BOARD.x + 50} y={r.y + BH / 2 - 30} size={52} color={gray[i] > 0.5 ? P.mid : P.ink}>
            {r.label}
          </Txt>
        ))}
        {ROWS.map((r, i) => {
          const op = prog(f, (i === 0 ? blk('S45', 2) : i === 1 ? blk('S46', 1) : blk('S47', 1)) + 20, 8);
          const neg = r.v < 0;
          const val = Math.round(r.v * grow[i]);
          const xEnd = ZX + r.v * K;
          return (
            <Txt key={'v' + i} x={neg ? xEnd + 24 : xEnd + 22} y={r.y + BH / 2 - 38} size={68} weight={900} color={neg ? P.white : gray[i] > 0.5 ? P.mid : P.ink} style={{opacity: op}}>
              {val > 0 ? '+' : val < 0 ? '−' : ''}
              {Math.abs(val)}%
            </Txt>
          );
        })}
        <Txt x={ZX + 18} y={AXIS_Y + 20} size={36} weight={700} color={P.mid}>
          更快 →
        </Txt>
        <Txt x={ZX - 18} y={AXIS_Y + 20} size={36} weight={700} color={P.mid} style={{transform: 'translateX(-100%)'}}>
          ← 更慢
        </Txt>
        <Bubble x={1190} y={92} text="做完了！" size={44} start={blk('S48', 0)} />
        <Svg>{f >= blk('S48', 2) ? <Strike x={1210} y={148} w={220} start={blk('S48', 2)} /> : null}</Svg>
      </CamDiv>
      <Keyword text="只有结果算数" cx={960} cy={895} size={88} start={kwT} />
      <Txt x={70} y={918} size={32} weight={600} color={P.mid} style={{opacity: prog(f, s45.from + 10, 10) * (1 - prog(f, kwT - 6, 8))}}>
        来源：METR 2025 实验 · 资深程序员
      </Txt>
    </AbsoluteFill>
  );
};
