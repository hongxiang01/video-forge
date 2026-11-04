import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Arm, Person, Card, Keyword, Mark, at, blk, prog, lerp, easeInOut, useF} from '../kit';
import {Rig, CamKey, WorldBg} from './SC07';

// SC06：S18–S19 第 2 章章首承接。
// S18 "带过新人的都知道，|交代任务这件难事|和用 AI 是一回事"：左新人、右机械臂；同一张任务卡一分为二滑向两边；"=" + 关键词"同一种难题"。
// S19 "管人的老办法，|放到 AI 身上照样管用"：四张编号小卡 1–4 在新人脚下排开，随后整排滑到机械臂脚下，旁边打勾。

const TaskCard: React.FC<{x: number; y: number; rot?: number}> = ({x, y, rot = 0}) => (
  <Card x={x} y={y} w={300} rot={rot}>
    <div style={{fontSize: 38, fontWeight: 900, marginBottom: 10}}>任务</div>
    <div style={{fontSize: 36, fontWeight: 800, lineHeight: 1.45}}>画一只表</div>
    <div style={{fontSize: 36, fontWeight: 800, lineHeight: 1.45}}>指针 4:30</div>
  </Card>
);

const NUM_W = 100;
const NUM_GAP = 30;

export const SC06: React.FC = () => {
  const f = useF();
  const s18 = at('S18');
  const s19 = at('S19');
  const split = easeInOut((f - (blk('S18', 1) + 2)) / 24);
  const same = blk('S18', 2);
  const cardIn = prog(f, s18.from + 20, 14);
  // 编号卡：先排在新人脚下，再整排滑到机械臂脚下
  const numIn = blk('S19', 0);
  const slide = easeInOut((f - (blk('S19', 1) + 2)) / 30);
  const rowW = NUM_W * 4 + NUM_GAP * 3;
  const rowX = lerp(360 - rowW / 2, 1560 - rowW / 2, slide);
  // 相机：先慢推向"同一种难题"，S19 跟着编号卡往机械臂一侧横移
  const keys: CamKey[] = [
    [s18.from - 12, 960, 540, 1.0],
    [blk('S18', 2) + 10, 960, 500, 1.06],
    [blk('S19', 1), 980, 520, 1.04],
    [blk('S19', 1) + 34, 1120, 540, 1.04],
    [s19.to + 10, 1140, 540, 1.06],
  ];
  return (
    <AbsoluteFill>
      <Rig keys={keys}>
        <Svg>
          <WorldBg x0={-400} x1={2600} y={760} />
          <Person x={360} floor={760} s={1.15} board={false} opacity={prog(f, s18.from - 12, 12)} />
          <Arm bx={1560} tx={1560} ty={470} railX0={1240} railX1={1860} open={0.3} />
          {/* 两张卡之间的等号：是一回事 */}
          <g opacity={prog(f, same, 8)}>
            <line x1={920} y1={385} x2={1000} y2={385} stroke={P.ink} strokeWidth={10} strokeLinecap="round" />
            <line x1={920} y1={420} x2={1000} y2={420} stroke={P.ink} strokeWidth={10} strokeLinecap="round" />
          </g>
          {f >= blk('S19', 1) + 34 ? <Mark x={1790} y={640} kind="ok" s={1.1} start={blk('S19', 1) + 34} /> : null}
        </Svg>
        {/* 同一张任务卡，一分为二送往两边 */}
        <div style={{position: 'absolute', inset: 0, opacity: cardIn, transform: `translateY(${(1 - cardIn) * -40}px)`}}>
          <TaskCard x={lerp(810, 490, split)} y={300} rot={lerp(0, -2, split)} />
          <TaskCard x={lerp(810, 1130, split)} y={300} rot={lerp(0, 2, split)} />
        </div>
        <Keyword text="同一种难题" cx={960} cy={640} start={same + 4} circle={false} />
        {/* 编号小卡 1–4 */}
        {[1, 2, 3, 4].map((n, i) => {
          const p = prog(f, numIn + i * 5, 10);
          return (
            <div key={n} style={{position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>
              <Card x={rowX + i * (NUM_W + NUM_GAP)} y={800} w={NUM_W} h={NUM_W} style={{padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{fontSize: 60, fontWeight: 900, color: P.accent, lineHeight: 1}}>{n}</span>
              </Card>
            </div>
          );
        })}
      </Rig>
    </AbsoluteFill>
  );
};
