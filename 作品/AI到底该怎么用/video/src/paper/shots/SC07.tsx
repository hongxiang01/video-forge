import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, FONT, W, H, Svg, Belt, Arm, Clock, Card, Txt, Sign, Strike, Person, at, blk, prog, lerp, easeInOut, useF} from '../kit';

// SC07：S20–S23 第 1 条「讲意图，不讲步骤」。整镜头在一条横向展开的车间里，相机横移 / 推近。
// S20 "第一条，|讲意图，不讲步骤"：流水线工位上方落下吊牌（num 1），相机慢推向吊牌。
// S21 "一八七一年，普鲁士的毛奇写过一句话"：相机横移到隔壁作战工位：墙上钉着来源小卡（1871 / 普鲁士 · 毛奇《论战略》），下方一张沙盘桌。
// S22 "任何作战计划，|碰上敌军主力之后，|都没法再有把握地照着走"：相机推近沙盘：三条箭头推进 → 敌军主力落下 → 箭头弯折散乱。
// S23 "所以他主张，|命令只下绝对必要的部分|怎么打，交给现场的人判断"：相机拉回，墙上钉出命令卡，灰色步骤行逐行划掉；沙盘上三个小人各走各的路到同一面旗。

// ───────── 本组镜头（SC06–SC09）共用的小工具 ─────────

/** 编号标签（左上角 110×110 方卡，橙红数字），start 时弹出 */
export const NumCard: React.FC<{n: number; start: number}> = ({n, start}) => {
  const f = useF();
  const pop = prog(f, start, 10);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: pop}}>
      <Card x={70} y={70} w={110} h={110} style={{padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.85 + 0.15 * pop})`, transformOrigin: '0 0'}}>
        <span style={{fontSize: 72, fontWeight: 900, color: P.accent, lineHeight: 1}}>{n}</span>
      </Card>
    </div>
  );
};

/** 相机关键帧：[帧, 视野中心 x, 视野中心 y, 缩放]，段间 easeInOut 插值 */
export type CamKey = [number, number, number, number];
const camAt = (f: number, keys: CamKey[]): [number, number, number] => {
  if (f <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (f < b[0]) {
      const t = easeInOut((f - a[0]) / Math.max(1, b[0] - a[0]));
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  const z = keys[keys.length - 1];
  return [z[1], z[2], z[3]];
};

/** 相机：子元素用"世界坐标"（可超出 1920 宽），按关键帧横移 / 推近 */
export const Rig: React.FC<{keys: CamKey[]; children: React.ReactNode}> = ({keys, children}) => {
  const f = useF();
  const [cx, cy, z] = camAt(f, keys);
  return <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 - cx * z}px, ${H / 2 - cy * z}px) scale(${z})`, transformOrigin: '0 0'}}>{children}</div>;
};

/** 横向车间背景：远景窗格 + 地面（世界坐标 x0..x1） */
export const WorldBg: React.FC<{x0: number; x1: number; y?: number}> = ({x0, x1, y = 900}) => (
  <g>
    {Array.from({length: Math.ceil((x1 - x0) / 290)}).map((_, i) => {
      const x = x0 + 60 + i * 290;
      return (
        <g key={i} opacity={0.55}>
          <rect x={x} y={200} width={220} height={130} fill="none" stroke={P.mid} strokeWidth={3} />
          <line x1={x + 110} y1={200} x2={x + 110} y2={330} stroke={P.mid} strokeWidth={2} />
        </g>
      );
    })}
    <rect x={x0} y={y} width={x1 - x0} height={700} fill={P.soft} />
    <line x1={x0} y1={y} x2={x1} y2={y} stroke={P.ink} strokeWidth={4} />
  </g>
);

/** 钉在墙上的卡（顶端一颗图钉） */
export const Pinned: React.FC<{x: number; y: number; w: number; h: number; rot?: number; opacity?: number; children: React.ReactNode}> = ({x, y, w, h, rot = 0, opacity = 1, children}) => (
  <div style={{position: 'absolute', inset: 0, opacity}}>
    <Card x={x} y={y} w={w} h={h} rot={rot}>
      {children}
    </Card>
    <div style={{position: 'absolute', left: x + w / 2 - 11, top: y - 8, width: 22, height: 22, borderRadius: 11, background: P.ink}} />
  </div>
);

/** 淡入 a、淡出 b（各 dur 帧） */
const win = (f: number, a: number, b: number, dur = 10) => Math.min(prog(f, a, dur), 1 - prog(f, b, dur));

/** 点列 → 折线路径 */
const poly = (pts: number[][]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** 箭头头部（沿最后一段方向） */
const Head: React.FC<{pts: number[][]; size?: number}> = ({pts, size = 26}) => {
  const [x0, y0] = pts[pts.length - 2];
  const [x1, y1] = pts[pts.length - 1];
  const a = Math.atan2(y1 - y0, x1 - x0);
  const p = (da: number) => `${x1 - Math.cos(a + da) * size} ${y1 - Math.sin(a + da) * size}`;
  return <path d={`M ${p(0.45)} L ${x1} ${y1} L ${p(-0.45)}`} stroke={P.ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
};

// 作战图（图内坐标系 viewBox 250 220 1420 600）：三条箭头，直线版 → 碰到主力后的变形版（逐点插值）
const XS = Array.from({length: 8}).map((_, i) => 330 + (i * 1230) / 7);
const PLAN_Y = [380, 510, 640];
const BENT: number[][][] = [
  [[330, 380], [505, 380], [681, 380], [857, 380], [1000, 372], [1090, 330], [1110, 268], [1050, 250]],
  [[330, 510], [505, 510], [681, 510], [857, 510], [1000, 505], [1100, 468], [1080, 560], [1145, 540]],
  [[330, 640], [505, 640], [681, 640], [857, 640], [1000, 650], [1080, 700], [1070, 755], [995, 775]],
];
const FLAG = [1450, 400];
const ROUTES: number[][][] = [
  [[420, 730], [380, 600], [520, 480], [900, 430], [1410, 405]],
  [[760, 760], [870, 660], [760, 570], [1010, 490], [1420, 420]],
  [[1100, 740], [1310, 690], [1520, 590], [1470, 440]],
];

// 沙盘桌（世界坐标）
const TABLE = {x0: 2440, x1: 3560, top: 640};
const PLATE = {w: 1100, h: 465};

export const SC07: React.FC = () => {
  const f = useF();
  const s20 = at('S20');
  const s21 = at('S21');
  const s22 = at('S22');
  const s23 = at('S23');
  const enemy = blk('S22', 1);
  const bend = easeInOut((f - (blk('S22', 2) - 4)) / 22);
  const strike0 = blk('S23', 1) + 6;
  const routes0 = blk('S23', 2);
  const planOp = 1 - prog(f, routes0 - 10, 10);
  const grayOp = 1 - 0.6 * prog(f, strike0 + 30, 12);
  const GRAY = ['第 1 步 ……', '第 2 步 ……', '第 3 步 ……', '第 4 步 ……'];
  const memoIn = prog(f, s23.from, 12);
  const keys: CamKey[] = [
    [s20.from - 12, 900, 540, 1.0],
    [s20.from + 40, 960, 520, 1.05],
    [s21.from - 4, 980, 520, 1.06],
    [s21.from + 26, 3200, 540, 1.0],
    [s22.from - 2, 3230, 540, 1.02],
    [s22.from + 30, 2900, 500, 1.22],
    [s23.from - 2, 2900, 500, 1.25],
    [s23.from + 26, 2690, 540, 1.0],
    [s23.to + 10, 2700, 540, 1.03],
  ];
  return (
    <AbsoluteFill>
      <Rig keys={keys}>
        <Svg>
          <WorldBg x0={-400} x1={4400} />
          {/* 工位 A：流水线 */}
          <Belt x0={60} x1={1700} y={700} phase={f} />
          <Clock cx={520} cy={630} h={10} m={10} />
          <Clock cx={900} cy={630} h={10} m={10} />
          <Arm bx={380} tx={520} ty={540} railX0={80} railX1={900} open={0.3} />
          {/* 工位 B：沙盘桌 */}
          <rect x={TABLE.x0} y={TABLE.top} width={TABLE.x1 - TABLE.x0} height={40} rx={6} fill={P.soft} stroke={P.ink} strokeWidth={5} />
          {[TABLE.x0 + 50, TABLE.x1 - 74].map((x) => (
            <rect key={x} x={x} y={TABLE.top + 40} width={24} height={900 - TABLE.top - 40} fill={P.ink} />
          ))}
          <line x1={TABLE.x0 + 74} y1={820} x2={TABLE.x1 - 74} y2={820} stroke={P.ink} strokeWidth={6} />
        </Svg>
        {/* 沙盘图板：平放在桌面上（CSS 透视） */}
        <div
          style={{
            position: 'absolute',
            left: (TABLE.x0 + TABLE.x1) / 2 - PLATE.w / 2,
            top: TABLE.top - PLATE.h,
            width: PLATE.w,
            height: PLATE.h,
            transform: 'perspective(1600px) rotateX(36deg)',
            transformOrigin: '50% 100%',
          }}
        >
          <svg width={PLATE.w} height={PLATE.h} viewBox="250 220 1420 600" style={{position: 'absolute', inset: 0}}>
            <rect x={252} y={222} width={1416} height={596} rx={10} fill={P.white} stroke={P.ink} strokeWidth={6} />
            <text x={290} y={300} fontFamily={FONT} fontWeight={800} fontSize={56} fill={P.mid}>
              作战计划
            </text>
            <g opacity={planOp}>
              {PLAN_Y.map((y0, k) => {
                const pts = XS.map((x, i) => [lerp(x, BENT[k][i][0], bend), lerp(y0, BENT[k][i][1], bend)]);
                const draw = prog(f, s22.from + 4 + k * 6, 24);
                return (
                  <g key={k}>
                    <path d={poly(pts)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} stroke={P.ink} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    {draw > 0.97 ? <Head pts={pts} size={34} /> : null}
                  </g>
                );
              })}
              {f >= enemy - 2 ? (
                <g opacity={prog(f, enemy - 2, 8)} transform={`translate(0 ${(1 - prog(f, enemy - 2, 12)) * -50})`}>
                  <rect x={1190} y={300} width={220} height={440} rx={10} fill={P.ink} />
                  <text x={1300} y={535} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={46} fill={P.bg} opacity={prog(f, enemy + 4, 8)}>
                    敌军主力
                  </text>
                </g>
              ) : null}
            </g>
            {/* S23：同一面旗，三条不同的路 */}
            {f >= routes0 - 4 ? (
              <g opacity={prog(f, routes0 - 4, 10)}>
                <line x1={FLAG[0]} y1={FLAG[1]} x2={FLAG[0]} y2={FLAG[1] - 170} stroke={P.ink} strokeWidth={7} strokeLinecap="round" />
                <path d={`M ${FLAG[0]} ${FLAG[1] - 170} l 100 36 l -100 36 Z`} fill={P.accent} />
              </g>
            ) : null}
            {ROUTES.map((pts, k) => {
              const st = routes0 + 8 + k * 8;
              const d = prog(f, st, 30);
              return f >= st ? (
                <g key={k}>
                  <mask id={`rm${k}`} maskUnits="userSpaceOnUse" x={0} y={0} width={2000} height={1200}>
                    <path d={poly(pts)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - d} stroke="#fff" strokeWidth={16} fill="none" />
                  </mask>
                  <path d={poly(pts)} strokeDasharray="16 12" stroke={P.ink} strokeWidth={8} fill="none" strokeLinecap="round" mask={`url(#rm${k})`} />
                  {d > 0.97 ? <Head pts={pts} size={22} /> : null}
                </g>
              ) : null;
            })}
            {ROUTES.map((pts, k) => (
              <g key={k} opacity={prog(f, routes0 + k * 4, 10)}>
                <Person x={pts[0][0]} floor={pts[0][1] + 80} s={0.5} board={false} />
              </g>
            ))}
          </svg>
        </div>
        {/* 吊牌 */}
        <Sign text="讲意图，不讲步骤" num="1" cx={1000} y={230} start={s20.from + 2} />
        {/* 墙上：来源小卡 */}
        <Pinned x={3640} y={250} w={400} h={330} rot={2} opacity={Math.min(prog(f, s21.from + 6, 12), 1 - prog(f, s22.from, 10))}>
          <div style={{fontSize: 120, fontWeight: 900, lineHeight: 1, letterSpacing: 2, textAlign: 'center'}}>1871</div>
          <div style={{fontSize: 40, fontWeight: 800, marginTop: 22, textAlign: 'center'}}>普鲁士 · 毛奇</div>
          <div style={{fontSize: 40, fontWeight: 800, marginTop: 6, textAlign: 'center'}}>《论战略》</div>
        </Pinned>
        {/* 墙上：命令卡（S23） */}
        <div style={{position: 'absolute', inset: 0, opacity: memoIn, transform: `translateY(${(1 - memoIn) * -30}px)`}}>
          <Pinned x={1960} y={230} w={460} h={590} rot={-1}>
            <span />
          </Pinned>
          <Txt x={2000} y={258} size={44} weight={900}>
            命令
          </Txt>
          <Txt x={2000} y={340} size={64} weight={900}>
            目标
          </Txt>
          <Txt x={2000} y={430} size={64} weight={900}>
            为什么
          </Txt>
          {GRAY.map((t, i) => (
            <Txt key={i} x={2000} y={542 + i * 68} size={40} weight={700} color={P.mid} style={{opacity: grayOp}}>
              {t}
            </Txt>
          ))}
          <Svg>
            <line x1={2000} y1={320} x2={2380} y2={320} stroke={P.ink} strokeWidth={3} />
            <line x1={2000} y1={520} x2={2380} y2={520} stroke={P.mid} strokeWidth={2} strokeDasharray="10 8" />
            {GRAY.map((_, i) => (f >= strike0 + i * 6 ? <Strike key={i} x={1992} y={568 + i * 68} w={260} start={strike0 + i * 6} /> : null))}
          </Svg>
        </div>
      </Rig>
      <NumCard n={1} start={s21.from + 24} />
      <Txt x={70} y={930} size={32} weight={600} color={P.mid} style={{opacity: win(f, s22.from, 99999)}}>
        毛奇 · 1871 ·《论战略》
      </Txt>
    </AbsoluteFill>
  );
};
