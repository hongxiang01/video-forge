import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Arm, Card, Txt, Strike, Mark, at, blk, prog, lerp, easeInOut, useF} from '../kit';
import {NumCard, Rig, CamKey, WorldBg} from './SC07';

// SC08：S24–S25（第 1 条落到 AI 上）。
// S24 "用 AI 也一样"：机械臂滑到一张空工单旁。
// S25 "与其写十条步骤，|不如说清楚给谁看、|要什么感觉、|哪里不能碰"：左侧十条步骤细行被逐行划掉压暗；工单上依次出现三行大字栏，各带绿勾。

const ROWS = ['给谁看', '要什么感觉', '哪里不能碰'];

export const SC08: React.FC = () => {
  const f = useF();
  const s24 = at('S24');
  const s25 = at('S25');
  const strike0 = blk('S25', 0) + 14;
  const stepsIn = prog(f, blk('S25', 0) - 4, 12);
  const stepsDim = 1 - 0.55 * prog(f, strike0 + 30, 12);
  const rowAt = [blk('S25', 1), blk('S25', 2), blk('S25', 3)];
  // 机械臂：S24 从右侧滑到工单边；每出一行轻点一下
  const slide = easeInOut((f - s24.from) / 24);
  const bx = lerp(1760, 1560, slide);
  const tap = rowAt.reduce((s, t) => s + Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (f - t) / 12)))), 0);
  const tx = lerp(1700, 1420, slide);
  const ty = 560 + tap * 24;
  // 相机：从机械臂横移到工单，再慢推近工单
  const keys: CamKey[] = [
    [s24.from - 12, 1180, 540, 1.0],
    [s24.to + 4, 1000, 540, 1.0],
    [s25.from + 20, 980, 530, 1.02],
    [s25.to + 10, 1000, 520, 1.08],
  ];
  return (
    <AbsoluteFill>
      <Rig keys={keys}>
        <Svg>
          <WorldBg x0={-400} x1={2600} />
          <Arm bx={bx} tx={tx} ty={ty} railX0={1320} railX1={1860} open={0.3} />
        </Svg>
        {/* 十条步骤 */}
        <div style={{position: 'absolute', inset: 0, opacity: stepsIn, transform: `translateY(${(1 - stepsIn) * 24}px)`}}>
          <Card x={140} y={200} w={400} h={640} />
          {Array.from({length: 10}).map((_, i) => (
            <Txt key={i} x={186} y={226 + i * 58} size={36} weight={700} color={P.mid}>
              步骤 {i + 1}
            </Txt>
          ))}
          <Svg>
            {Array.from({length: 10}).map((_, i) => (
              <line key={i} x1={350} y1={252 + i * 58} x2={i % 3 === 2 ? 440 : 500} y2={252 + i * 58} stroke={P.soft} strokeWidth={6} strokeLinecap="round" />
            ))}
          </Svg>
          <Svg>{Array.from({length: 10}).map((_, i) => (f >= strike0 + i * 2 ? <Strike key={i} x={176} y={252 + i * 58} w={330} start={strike0 + i * 2} /> : null))}</Svg>
          <div style={{position: 'absolute', left: 136, top: 196, width: 420, height: 660, background: P.bg, opacity: 1 - stepsDim}} />
        </div>
        {/* 工单：三行大字栏 */}
        <div style={{position: 'absolute', inset: 0, opacity: prog(f, s24.from - 12, 12)}}>
          <Card x={640} y={200} w={660} h={640} />
          <Txt x={690} y={232} size={40} weight={900}>
            工单
          </Txt>
          {ROWS.map((t, i) => (
            <Txt key={i} x={790} y={350 + i * 160} size={64} weight={900} style={{opacity: prog(f, rowAt[i] - 3, 8), transform: `translateY(${(1 - prog(f, rowAt[i] - 3, 10)) * 16}px)`}}>
              {t}
            </Txt>
          ))}
          <Svg>
            {ROWS.map((_, i) => (
              <g key={i}>
                <line x1={690} y1={440 + i * 160} x2={1250} y2={440 + i * 160} stroke={P.mid} strokeWidth={3} strokeDasharray="12 10" />
                {f >= rowAt[i] + 6 ? <Mark x={730} y={392 + i * 160} kind="ok" start={rowAt[i] + 6} /> : null}
              </g>
            ))}
          </Svg>
        </div>
      </Rig>
      <NumCard n={1} start={-100} />
    </AbsoluteFill>
  );
};
