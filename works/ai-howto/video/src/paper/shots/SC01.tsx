import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Card, Txt, Callout, Mark, Highlight, at, blk, prog, lerp, easeInOut, useF} from '../kit';

// SC01：S01–S03 开头钩子。
// S01 "你让 AI 画一只表，|指针停在四点半"：工单落下，"4:30" 被荧光笔扫过。
// S02 "去年夏天，有人真这么试过"：左下角来源小字（2025-08 实测，OfficeChai）。
// S03 "它想了十四秒，|交上来一只十点十分的表"：机械臂悬停 + 计时 0→14 秒；第 2 块时表盘冒出 10:10 指针，标注线 + 工单打叉。

// 相机：从 (1010,470) 1.6 倍特写开场，S01 后半到 S02 拉回全景；S03 交表时推到 (800,560) 1.3 倍
const camT = (f: number, a: number, b: number, rv: number) => {
  const pull = easeInOut((f - (a + 40)) / Math.max(1, b - a - 40));
  let s = lerp(1.6, 1, pull);
  let cx = lerp(1010, 960, pull);
  let cy = lerp(470, 540, pull);
  const push = easeInOut((f - (rv - 6)) / 24);
  s = lerp(s, 1.3, push);
  cx = lerp(cx, 800, push);
  cy = lerp(cy, 560, push);
  return `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`;
};

export const SC01: React.FC = () => {
  const f = useF();
  const s1 = at('S01');
  const s3 = at('S03');
  const think0 = blk('S03', 0);
  const reveal = blk('S03', 1);
  // 机械臂：开场在右侧小车位，S01 末滑到空表盘上方，S03 思考时缓慢下降
  const slide = easeInOut((f - (s1.from + 20)) / 40);
  const bx = lerp(1150, 760, slide);
  const down = easeInOut((f - think0) / (reveal - think0));
  const ty = lerp(430, 560, down);
  const secs = Math.min(14, Math.max(0, Math.floor(((f - think0) / Math.max(1, reveal - think0 - 4)) * 14)));
  const thinking = f >= think0 && f < reveal + 6;
  const handsP = prog(f, reveal, 8);
  return (
    <AbsoluteFill>
      {/* 开场特写（评审 v1：第 0 帧就要有主体）→ S02 拉到全景 → S03 交表时推近到表盘 */}
      <div style={{position: 'absolute', inset: 0, transform: camT(f, s1.from, at('S02').to, reveal), transformOrigin: '0 0'}}>
        <Svg>
          <Floor />
          <Belt phase={f} />
          {/* 空表盘（还没有指针） → reveal 时出现 10:10 */}
          <g>
            <rect x={694} y={564} width={132} height={132} rx={10} fill={P.soft} stroke={P.ink} strokeWidth={4} />
            <circle cx={760} cy={630} r={52} fill={P.bg} stroke={P.ink} strokeWidth={4} />
            {Array.from({length: 12}).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r1 = 52 - (i % 3 === 0 ? 13 : 8);
              return <line key={i} x1={760 + Math.cos(a) * r1} y1={630 + Math.sin(a) * r1} x2={760 + Math.cos(a) * 49} y2={630 + Math.sin(a) * 49} stroke={P.ink} strokeWidth={i % 3 === 0 ? 4 : 2} />;
            })}
          </g>
          {handsP > 0 ? (
            <g transform={`translate(760 630) scale(${0.6 + 0.4 * handsP}) translate(-760 -630)`} opacity={handsP}>
              <Clock cx={760} cy={630} r={52} h={10} m={10} hot box={false} />
            </g>
          ) : null}
          {/* 其它已有的钟（背景，全是 10:10） */}
          <Clock cx={240} cy={630} h={10} m={10} opacity={0.9} />
          <Clock cx={460} cy={630} h={10} m={10} opacity={0.9} />
          <Arm bx={bx} tx={bx} ty={ty} open={thinking ? 0.6 : 0.2} />
          {thinking ? (
            <g>
              {[0, 1, 2].map((i) => (
                <circle key={i} cx={bx + 110 + i * 26} cy={ty - 150} r={8} fill={P.ink} opacity={0.25 + 0.75 * (Math.floor(f / 6) % 3 === i ? 1 : 0)} />
              ))}
            </g>
          ) : null}
        </Svg>
        {/* 计时器 */}
        {f >= think0 ? (
          <Txt x={bx + 100} y={ty - 250} size={64} weight={900} style={{opacity: Math.min(prog(f, think0, 6), 1 - prog(f, reveal + 4, 8))}}>
            {secs}
            <span style={{fontSize: 34, fontWeight: 700, marginLeft: 8}}>秒</span>
          </Txt>
        ) : null}
        {/* 工单 */}
        <div style={{position: 'absolute', inset: 0, opacity: prog(f, s1.from, 12), transform: `translateY(${(1 - prog(f, s1.from, 14)) * -60}px)`}}>
          <Card x={1240} y={300} w={420} title="工单" rot={2}>
            <div style={{fontSize: 40, fontWeight: 800, lineHeight: 1.5}}>画一只表</div>
            <div style={{position: 'relative', fontSize: 40, fontWeight: 800, lineHeight: 1.5}}>
              <Highlight x={-6} y={6} w={210} h={52} start={blk('S01', 1)} />
              <span style={{position: 'relative'}}>指针：4:30</span>
            </div>
          </Card>
        </div>
        <Svg>{f >= reveal + 20 ? <Mark x={1590} y={430} kind="no" s={1.1} start={reveal + 20} /> : null}</Svg>
        {f >= reveal + 8 ? <Callout x={760} y={630} ex={880} ey={460} len={150} label="10:10" start={reveal + 8} size={56} /> : null}
      </div>
      {/* 来源 */}
      <Txt x={70} y={930} size={32} weight={600} color={P.mid} style={{opacity: prog(f, at('S02').from, 10)}}>
        2025 年 8 月实测 · 来源：OfficeChai
      </Txt>
    </AbsoluteFill>
  );
};
