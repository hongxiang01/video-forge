import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Person, at, blk, prog, lerp, easeInOut, useF, W, H} from '../kit';
import {Panorama, Spot, SPOTS, FEET, PS, CamDiv} from './SC15';

// SC16：S53 "AI 能干的活越来越多|这三件事，|反而越来越只能是人的"
// 同一全景：相机先贴近机械臂区，皮带加速（3 倍速），机械臂从 1 台变 3 台忙碌；
// 第 2 块相机拉回全景，三个人的位置各出现一个橙红小圆点；第 3 块人以外的元素被 P.mid 透明层压暗（压暗层在人下面）。

export const SC16: React.FC = () => {
  const f = useF();
  const s53 = at('S53');
  const b0 = blk('S53', 0);
  const b1 = blk('S53', 1);
  const b2 = blk('S53', 2);
  // 皮带相位：b0 前 1 倍速，之后 3 倍速（相位连续）
  const ip = f < b0 ? f : b0 + (f - b0) * 3;
  const more = easeInOut((f - b0) / 20);
  // 夹爪只在钟盒上方 380–440 之间忙（钟盒顶 ≈471，夹爪末端 = ty+20）
  const busy = (k: number) => 410 + 30 * Math.sin(f / 4 + k * 2.1);
  const arms = [
    {bx: 720, ty: lerp(420 + 14 * Math.sin(f / 9), busy(0), more)},
    {bx: lerp(300, 480, more), ty: busy(1)},
    {bx: lerp(1080, 960, more), ty: busy(2)},
  ].filter((_, i) => i === 0 || more > 0);
  const dim = prog(f, b2, 14);
  return (
    <AbsoluteFill>
      <CamDiv
        f={f}
        keys={[
          [s53.from - 12, 1.3, 760, 380],
          [b1 - 8, 1.3, 760, 380],
          [b1 + 18, 1.0, 960, 540],
          [s53.to + 20, 1.04, 960, 600],
        ]}
      >
        <Panorama f={f} ip={ip} arms={arms} />
        <Svg>
          {/* 压暗层：在人和圆点下面 */}
          <rect x={-200} y={-200} width={W + 400} height={H + 400} fill={P.mid} opacity={0.35 * dim} />
          {SPOTS.map((x, i) => (
            <g key={i}>
              <Spot x={x} op={1} color={dim > 0.5 ? P.ink : P.mid} />
              <circle cx={x} cy={FEET - 92} r={98} fill={P.bg} opacity={dim} />
              <Person x={x} floor={FEET} s={PS} board={i === 2} check={i === 2} />
              <circle cx={x + 74} cy={FEET - 178} r={16 * prog(f, b1 + i * 5, 8)} fill={P.accent} />
            </g>
          ))}
        </Svg>
      </CamDiv>
    </AbsoluteFill>
  );
};
