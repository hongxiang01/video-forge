import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, FONT, Svg, Floor, Belt, Arm, Gate, Card, Mark, Strike, at, blk, prog, lerp, easeInOut, useF} from '../kit';

// SC11：S35–S36 AI 的自述不可信 → 让结果自己过检测门。
// S35 "放到 AI 身上，|就是别只听它说做完了"：机械臂把一份文档放上传送带，冒出气泡"做完了！"；第 2 块气泡被划掉。
// S36 "让结果自己证明：|字数够不够、|链接打不打得开、|数字对不对得上"：文档沿带子进检测门，门上三项依次检：字数 ✓、链接 ✓、数字 ✗，文档被推回。

const DOC_W = 130;
const DOC_H = 150;
const BELT_Y = 720;

/** 文档卡（SVG）：x 为中心，top 为上沿 */
const Doc: React.FC<{x: number; top: number; rot?: number}> = ({x, top, rot = 0}) => (
  <g transform={`rotate(${rot} ${x} ${top + DOC_H})`}>
    <rect x={x - DOC_W / 2} y={top} width={DOC_W} height={DOC_H} rx={6} fill={P.white} stroke={P.ink} strokeWidth={4} />
    {[0, 1, 2, 3, 4].map((i) => (
      <line key={i} x1={x - DOC_W / 2 + 20} y1={top + 30 + i * 22} x2={x + DOC_W / 2 - (i === 4 ? 56 : 20)} y2={top + 30 + i * 22} stroke={P.mid} strokeWidth={5} strokeLinecap="round" />
    ))}
  </g>
);

const GATE_X = 1100;
const GATE_W = 320;
const GATE_CX = GATE_X + 15 + GATE_W / 2; // 门洞中心
const PANEL = {x: 1100, y: 140, w: 340};
const ROWS = ['字数', '链接', '数字'];
const rowY = (i: number) => PANEL.y + 4 + 22 + 35 + i * 70;

/** 关键帧相机：keys=[帧, 缩放, 焦点x, 焦点y]，焦点放到画面中心 */
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

/** AI 自述气泡：放在机械臂左侧，尾巴（SVG）实时指向夹爪 (tipX, tipY) */
const BUB = {x: 110, y: 200, w: 270, h: 96};
const ClaimBubble: React.FC<{text: string; start: number; tipX: number; tipY: number}> = ({text, start, tipX, tipY}) => {
  const f = useF();
  const p = prog(f, start, 10);
  if (p <= 0) return null;
  const by = BUB.y + BUB.h - 6;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: p}}>
      <Svg>
        <path d={`M ${BUB.x + BUB.w - 90} ${by} L ${tipX} ${tipY} L ${BUB.x + BUB.w - 44} ${by} Z`} fill={P.white} stroke={P.ink} strokeWidth={4} strokeLinejoin="round" />
      </Svg>
      <div style={{position: 'absolute', left: BUB.x, top: BUB.y, width: BUB.w, height: BUB.h, boxSizing: 'border-box', transform: `scale(${0.8 + 0.2 * p})`, transformOrigin: '100% 100%', background: P.white, border: `4px solid ${P.ink}`, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 48, color: P.ink, whiteSpace: 'nowrap'}}>
        {text}
      </div>
    </div>
  );
};

export const SC11: React.FC = () => {
  const f = useF();
  const s35 = at('S35');
  const s36 = at('S36');
  const doneT = blk('S35', 0) + 18;
  const strikeT = blk('S35', 1) + 10;
  const checks = [blk('S36', 1) + 6, blk('S36', 2) + 6, blk('S36', 3) + 6];
  const fail = checks[2];

  // 机械臂：抱着文档下放 → 松手 → 抬起
  const bx = 420;
  const lower = easeInOut((f - (s35.from - 10)) / 26);
  const rise = easeInOut((f - (s35.from + 22)) / 22);
  const ty = lerp(lerp(380, 550, lower), 360, rise);
  const holding = f < s35.from + 20;
  // 文档：放下 → 送进门 → 检测 → 被推回
  const toGate = easeInOut((f - (s36.from + 2)) / 34);
  const back = easeInOut((f - (fail + 8)) / 18);
  const docX = lerp(lerp(bx, GATE_CX, toGate), 720, back);
  const docTop = holding ? ty + 20 : BELT_Y - DOC_H;
  const docRot = back > 0 && back < 1 ? -6 * Math.sin(Math.PI * back) : 0;
  const beltPhase = f < fail + 8 ? f : f < fail + 26 ? fail + 8 - (f - fail - 8) * 1.5 : fail + 8 - 27;

  const passed = checks.filter((c) => f >= c).length;
  const lamp = f >= fail ? P.accent : passed > 0 ? P.ok : P.mid;
  const scanning = f >= s36.from + 30 && f < fail + 8;

  // 相机：S35 推近机械臂 → S36 横移跟文档到检测门 → 推回时轻推近
  const cam: CamKey[] = [
    [s35.from - 12, 1.1, 600, 480],
    [s35.to, 1.2, 520, 470],
    [s36.from + 2, 1.2, 520, 470],
    [s36.from + 40, 1.1, 1180, 470],
    [fail + 4, 1.1, 1180, 470],
    [s36.to + 40, 1.16, 1080, 480],
  ];

  return (
    <AbsoluteFill>
      <KCam keys={cam}>
        <Svg>
          <Floor />
          <Belt x0={60} x1={1860} y={BELT_Y} phase={beltPhase} />
          {/* 检测门 + 吊挂的检测项面板 */}
          <line x1={PANEL.x + 60} y1={PANEL.y + 262} x2={PANEL.x + 60} y2={460} stroke={P.ink} strokeWidth={4} />
          <line x1={PANEL.x + PANEL.w - 60} y1={PANEL.y + 262} x2={PANEL.x + PANEL.w - 60} y2={460} stroke={P.ink} strokeWidth={4} />
          <Doc x={docX} top={docTop} rot={docRot} />
          <Gate x={GATE_X} y={460} bottom={BELT_Y} w={GATE_W} beam={scanning ? (Math.floor(f / 5) % 2 ? 1 : 0.5) : 0.3} lamp={lamp} />
          <Arm bx={bx} tx={bx} ty={ty} railY={150} railX0={80} railX1={1000} open={holding ? 0 : 0.5} />
        </Svg>
        {/* 检测项面板 */}
        <div style={{position: 'absolute', inset: 0, opacity: prog(f, s36.from - 4, 12)}}>
          <Card x={PANEL.x} y={PANEL.y} w={PANEL.w} h={262}>
            {ROWS.map((r, i) => (
              <div key={r} style={{fontSize: 52, fontWeight: 900, lineHeight: '70px', color: f >= checks[i] - 6 ? P.ink : P.mid}}>
                {r}
              </div>
            ))}
          </Card>
          <Svg>
            {checks.map((c, i) => (f >= c ? <Mark key={i} x={PANEL.x + 260} y={rowY(i)} s={i === 2 ? 0.9 : 1} kind={i === 2 ? 'no' : 'ok'} start={c} /> : null))}
          </Svg>
        </div>
        {/* AI 的自述 */}
        <div style={{position: 'absolute', inset: 0, opacity: f >= s36.from ? 1 - prog(f, s36.from + 6, 14) : 1}}>
          <ClaimBubble text="做完了！" start={doneT} tipX={bx - 34} tipY={ty - 14} />
          <Svg>
            <Strike x={BUB.x - 10} y={BUB.y + BUB.h / 2 + 4} w={BUB.w + 20} start={strikeT} />
          </Svg>
        </div>
      </KCam>
    </AbsoluteFill>
  );
};
