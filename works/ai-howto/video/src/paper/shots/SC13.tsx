import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Card, Txt, Mark, Sign, at, blk, prog, lerp, easeInOut, useF} from '../kit';
import {CamDiv} from './SC15';

// SC13：S43–S44 第 3 章首。
// S43 "四条说完，|会发现没有一条在教 AI 干活"：四张编号卡（带短标签）挂在流水线上方，机械臂在下方干活；
//      第 2 块时四条虚线从卡片指向机械臂，汇合处打橙红叉。相机慢推。
// S44 "它们都在回答同一个问题|人站在哪"：四张卡收拢到右侧变成一个问号；"人站在哪"吊牌从上方落到流水线上空，相机推向吊牌。

const CARDS = [
  {n: '1', label: '讲意图', cx: 420},
  {n: '2', label: '看能否撤回', cx: 780},
  {n: '3', label: '机器拦', cx: 1140},
  {n: '4', label: '小步迭代', cx: 1500},
];
const CARD_Y = 150;
const HUB = {x: 960, y: 500}; // 机械臂小车顶部（线的汇合点）
const QM = {x: 1420, y: 300}; // 问号中心（吊牌右侧）

const QPATH = `M ${QM.x - 55} ${QM.y - 60} Q ${QM.x - 55} ${QM.y - 115} ${QM.x} ${QM.y - 115} Q ${QM.x + 58} ${QM.y - 115} ${QM.x + 58} ${QM.y - 65} Q ${QM.x + 58} ${QM.y - 27} ${QM.x + 15} ${QM.y - 4} Q ${QM.x} ${QM.y + 6} ${QM.x} ${QM.y + 38}`;

export const SC13: React.FC = () => {
  const f = useF();
  const s43 = at('S43');
  const s44 = at('S44');
  const lineT = blk('S43', 1);
  const gather = s44.from;
  const signT = blk('S44', 1) - 4;
  const g = easeInOut((f - gather) / 22);
  const qDraw = prog(f, gather + 16, 18);
  const armTy = lerp(655, 690, 0.5 + 0.5 * Math.sin((f - s43.from) / 22));
  return (
    <AbsoluteFill>
      <CamDiv
        f={f}
        keys={[
          [s43.from - 12, 1.0, 960, 540],
          [lineT + 40, 1.06, 960, 520],
          [signT, 1.06, 960, 520],
          [signT + 24, 1.15, 980, 495],
          [s44.to + 30, 1.17, 980, 500],
        ]}
      >
        <Svg>
          <Floor y={900} windows={false} />
          <Belt x0={460} x1={1460} y={800} floor={900} phase={f} />
          <Clock cx={960} cy={754} r={36} h={10} m={10} />
          <Arm bx={960} tx={960} ty={armTy} railY={520} railX0={560} railX1={1360} open={0.3} />
          {/* 卡片 → 机械臂的连线（"教 AI 干活"），随后被叉掉 */}
          <g opacity={1 - g}>
            {CARDS.map((c, i) => {
              const p = prog(f, lineT + i * 4, 14);
              const x2 = lerp(c.cx, HUB.x, p);
              const y2 = lerp(360, HUB.y - 20, p);
              return <line key={i} x1={c.cx} y1={360} x2={x2} y2={y2} stroke={P.ink} strokeWidth={4} strokeDasharray="12 10" opacity={p > 0 ? 1 : 0} />;
            })}
            {f >= lineT + 30 ? (
              <g>
                <circle cx={HUB.x} cy={HUB.y - 70} r={46} fill={P.bg} />
                <Mark x={HUB.x} y={HUB.y - 70} s={1.3} kind="no" start={lineT + 30} />
              </g>
            ) : null}
          </g>
          {/* 问号（四张卡收拢而成） */}
          {qDraw > 0 ? (
            <g>
              <path d={QPATH} fill="none" stroke={P.ink} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - qDraw} />
              <circle cx={QM.x} cy={QM.y + 78} r={12 * prog(f, gather + 32, 8)} fill={P.ink} />
            </g>
          ) : null}
        </Svg>
        {CARDS.map((c, i) => {
          const op = prog(f, s43.from + 4 + i * 5, 12) * (1 - prog(f, gather + 12, 10));
          const cx = lerp(c.cx, QM.x, g);
          const cy = lerp(CARD_Y + 55, QM.y - 40, g);
          const sc = lerp(1, 0.35, g);
          return (
            <div key={i} style={{position: 'absolute', inset: 0, opacity: op}}>
              <div style={{position: 'absolute', left: 0, top: 0, transform: `translate(${cx - 55}px, ${cy - 55}px) scale(${sc})`, transformOrigin: '55px 55px'}}>
                <Card x={0} y={0} w={110} h={110} style={{padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <div style={{fontSize: 72, fontWeight: 900, color: P.accent, lineHeight: 1}}>{c.n}</div>
                </Card>
              </div>
              <Txt x={c.cx} y={CARD_Y + 130} size={42} center style={{opacity: 1 - g}}>
                {c.label}
              </Txt>
            </div>
          );
        })}
        <Sign text="人站在哪" cx={900} y={210} size={96} start={signT} />
      </CamDiv>
    </AbsoluteFill>
  );
};
